/**
 * Authentication functions for the Granblue Fantasy Chrome extension.
 * Handles login and user information requests to the Granblue Team API.
 */

import { apiFetch, getApiUrl, getEnvConfig } from './constants.js'

interface ApiError extends Error {
  code: string
}

interface AuthUser {
  id: string
  username: string
}

export interface AuthData {
  access_token: string
  token_type: string
  expires_at: number
  refresh_token: string
  user: AuthUser
}

interface RawAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  user: AuthUser
}

async function authenticatedFetch(
  endpoint: string,
  accessToken: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiUrl = await getApiUrl(endpoint)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  }

  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await apiFetch(apiUrl, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  })

  if (!response.ok) {
    const err = new Error(`API request failed: ${response.status}`) as ApiError
    err.code = 'request_failed'
    throw err
  }

  return response.json()
}

export async function performLogin(
  username: string,
  password: string
): Promise<AuthData> {
  const config = await getEnvConfig()

  const response = await apiFetch(`${config.apiUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: username,
      password,
      grant_type: 'password'
    })
  })

  if (!response.ok) {
    let code = 'unknown'
    try {
      const errBody = (await response.json()) as { error?: string }
      code = errBody.error ?? 'unknown'
    } catch {
      // ignore
    }
    const err = new Error(code) as ApiError
    err.code = code
    throw err
  }

  const data = (await response.json()) as RawAuthResponse
  return formatAuthData(data)
}

/**
 * Exchanges the stored refresh token for a new access/refresh token pair.
 * Fields stored alongside the tokens (language, display settings) are kept.
 *
 * Throws with code 'refresh_unauthorized' when the server rejects the refresh
 * token (the user must log in again) and 'refresh_failed' for anything else,
 * so a transient outage doesn't log the user out.
 */
export async function refreshAuth<T extends AuthData>(auth: T): Promise<T> {
  const config = await getEnvConfig()

  let response: Response
  try {
    response = await apiFetch(`${config.apiUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: auth.refresh_token,
        grant_type: 'refresh_token'
      })
    })
  } catch {
    const err = new Error('refresh_failed') as ApiError
    err.code = 'refresh_failed'
    throw err
  }

  if (!response.ok) {
    const code =
      response.status === 400 || response.status === 401
        ? 'refresh_unauthorized'
        : 'refresh_failed'
    const err = new Error(code) as ApiError
    err.code = code
    throw err
  }

  const data = (await response.json()) as RawAuthResponse
  return { ...auth, ...formatAuthData(data) }
}

function formatAuthData(data: RawAuthResponse): AuthData {
  const nowMs = Date.now()
  const expiresMs = nowMs + data.expires_in * 1000

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_at: expiresMs,
    refresh_token: data.refresh_token,
    user: {
      id: data.user.id,
      username: data.user.username
    }
  }
}

export async function fetchUserInfo(accessToken: string): Promise<unknown> {
  return authenticatedFetch('/users/me', accessToken)
}

export async function updateUserLanguage(
  accessToken: string,
  language: string
): Promise<unknown> {
  return authenticatedFetch('/users/me', accessToken, {
    method: 'PUT',
    body: { user: { language } }
  })
}
