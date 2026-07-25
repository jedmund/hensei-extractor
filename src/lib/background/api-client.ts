import { apiFetch, getApiUrl } from '../constants.js'
import type { ApiResult, AuthToken } from './types.js'

export async function getAuthToken(): Promise<AuthToken | null> {
  const result = await chrome.storage.local.get('gbAuth')
  const auth = result.gbAuth as AuthToken | undefined

  if (!auth?.access_token) {
    return null
  }

  if (auth.expires_at && Date.now() > auth.expires_at) {
    return null
  }

  return auth
}

export async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { error?: string }
    if (json.error) return json.error
  } catch {
    /* not JSON */
  }
  return 'server_error'
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
      return { error: await parseErrorResponse(response) }
    }

    return { data: (await response.json()) as Record<string, unknown>, auth }
  } catch {
    return { error: 'request_failed' }
  }
}
