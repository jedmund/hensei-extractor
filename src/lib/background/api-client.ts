import { refreshAuth, type AuthData } from '../auth.js'
import { apiFetch, getApiUrl } from '../constants.js'
import type { ApiResult, AuthToken } from './types.js'

// Refresh a day early so a request never goes out with a token that expires mid-flight.
const AUTH_REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000

// Doorkeeper revokes a refresh token once it's used, so concurrent refreshes
// would log the user out. All refreshes go through this worker and share one
// in-flight request.
let authRefresh: Promise<AuthToken | null> | null = null

export async function getAuthToken(): Promise<AuthToken | null> {
  const result = await chrome.storage.local.get('gbAuth')
  const auth = result.gbAuth as (AuthToken & Partial<AuthData>) | undefined

  if (!auth?.access_token) {
    return null
  }

  const expired = !!auth.expires_at && Date.now() > auth.expires_at
  const expiringSoon =
    !!auth.expires_at && Date.now() > auth.expires_at - AUTH_REFRESH_MARGIN_MS

  if (!expiringSoon) return auth
  if (!auth.refresh_token) return expired ? null : auth

  authRefresh ??= refreshStoredAuth(auth as AuthToken & AuthData, expired)
  return authRefresh
}

async function refreshStoredAuth(
  auth: AuthToken & AuthData,
  expired: boolean
): Promise<AuthToken | null> {
  try {
    const refreshed = await refreshAuth(auth)
    await chrome.storage.local.set({ gbAuth: refreshed })
    return refreshed
  } catch (error) {
    if ((error as { code?: string }).code === 'refresh_unauthorized') {
      await chrome.storage.local.remove('gbAuth')
      return null
    }
    // Transient failure: keep the stored login and use it while it's still valid.
    return expired ? null : auth
  } finally {
    authRefresh = null
  }
}

export interface ApiError {
  error: string
  /** Per-item failures from a 422 `{ errors: [...] }` body */
  errors?: ApiItemError[]
  fieldErrors?: Record<string, string[]>
  /** Internal detail for recognizing domain failures; never displayed directly. */
  message?: string
}

export interface ApiItemError {
  error: string
  granblue_id?: string
  [key: string]: unknown
}

/** Normalize the API's string, nested, field-validation and per-item errors. */
export async function parseErrorBody(response: Response): Promise<ApiError> {
  // Status takes precedence over a proxy page or unexpected server exception.
  if (response.status >= 500) return { error: 'server_error' }
  const statusErrors: Record<number, string> = {
    401: 'invalid_token',
    403: 'forbidden',
    404: 'not_found',
    408: 'request_timeout',
    409: 'conflict',
    413: 'too_large',
    429: 'rate_limited'
  }
  const fallback =
    statusErrors[response.status] ??
    ([400, 422].includes(response.status) ? 'invalid_data' : 'request_rejected')
  try {
    const json: unknown = await response.json()
    if (!json || typeof json !== 'object') return { error: fallback }
    const body = json as Record<string, unknown>
    const fieldErrors: Record<string, string[]> = {}
    if (
      body.errors &&
      typeof body.errors === 'object' &&
      !Array.isArray(body.errors)
    ) {
      for (const [field, messages] of Object.entries(body.errors)) {
        if (
          Array.isArray(messages) &&
          messages.every((m) => typeof m === 'string')
        ) {
          fieldErrors[field] = messages
        }
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { error: fallback, fieldErrors }
    }
    const errors = Array.isArray(body.errors)
      ? body.errors.filter(
          (item): item is ApiItemError =>
            !!item && typeof item === 'object' && typeof item.error === 'string'
        )
      : []
    const nested =
      body.error && typeof body.error === 'object'
        ? (body.error as Record<string, unknown>)
        : undefined
    const rescued =
      body.errors &&
      typeof body.errors === 'object' &&
      !Array.isArray(body.errors)
        ? (body.errors as Record<string, unknown>)
        : undefined
    const detail = rescued?.message ?? body.message
    const message = typeof detail === 'string' ? detail : undefined
    const code =
      body.code ??
      rescued?.code ??
      (typeof body.error === 'string' ? body.error : nested?.code)
    // Keep known domain codes; never expose arbitrary server exception text.
    const knownCodes = [
      'invalid_data',
      'invalid_token',
      'not_in_crew',
      'already_in_crew',
      'not_officer',
      'no_items',
      'no_cached_data',
      'stale_data',
      'not_found',
      'forbidden',
      'unauthorized',
      'rate_limited'
    ]
    const error =
      typeof code === 'string' && knownCodes.includes(code) ? code : fallback
    return errors.length
      ? { error, errors }
      : { error, ...(message ? { message } : {}) }
  } catch {
    return { error: fallback }
  }
}

export async function parseErrorResponse(response: Response): Promise<string> {
  return (await parseErrorBody(response)).error
}

export async function authenticatedPost(
  endpoint: string,
  body: unknown
): Promise<ApiResult> {
  const auth = await getAuthToken()
  if (!auth) return { error: 'not_logged_in' }

  const apiUrl = await getApiUrl(endpoint)
  try {
    const response = await apiFetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.access_token}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      return await parseErrorBody(response)
    }

    return { data: (await response.json()) as Record<string, unknown>, auth }
  } catch {
    return { error: 'request_failed' }
  }
}
