/**
 * Authentication functions for the Granblue Fantasy Chrome extension.
 * Handles login and user information requests to the Granblue Team API.
 */

import { getApiUrl, getEnvConfig } from './constants.js'

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

  const response = await fetch(apiUrl, {
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

  const response = await fetch(`${config.apiUrl}/oauth/token`, {
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
