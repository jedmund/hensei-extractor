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
  /** Human-readable detail when the API sends one (English, not for display) */
  message?: string
}

export interface ApiItemError {
  error: string
  granblue_id?: string
  [key: string]: unknown
}

export async function parseErrorBody(response: Response): Promise<ApiError> {
  try {
    const json = (await response.json()) as {
      error?: string
      errors?: ApiItemError[] | { message?: string; code?: string }
      message?: string
      code?: string
    }
    if (json.error) return { error: json.error }
    if (Array.isArray(json.errors)) {
      if (json.errors.length > 0) {
        return { error: 'invalid_data', errors: json.errors }
      }
    } else if (json.errors?.code || json.errors?.message) {
      // Rescued exceptions: `{ errors: { message, code? } }`
      return {
        error: json.errors.code ?? 'invalid_data',
        message: json.errors.message
      }
    }
    // Domain errors (crews, shares): `{ code, message }`
    if (json.code) return { error: json.code, message: json.message }
  } catch {
    /* not JSON */
  }
  return { error: 'server_error' }
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
