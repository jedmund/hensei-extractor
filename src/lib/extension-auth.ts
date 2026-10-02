/**
 * Log in through the granblue.team website instead of with a password.
 *
 * The extension opens <siteUrl>/auth/extension with chrome.identity's web
 * auth flow, using PKCE (S256) and a random state. The site logs the user in
 * with any method it supports, then sends the browser to the extension's
 * redirect URL with a one-time code, which is exchanged at
 * POST /extension_auth/token for the same token body as /oauth/token.
 *
 * Never log the verifier, the code or the tokens.
 */

import {
  formatAuthData,
  type ApiError,
  type AuthData,
  type RawAuthResponse
} from './auth.js'
import { apiFetch, getApiUrl, getSiteBaseUrl } from './constants.js'

/** Chrome's message when the user closes the auth window. */
const USER_CLOSED_WINDOW = 'The user did not approve access.'

export interface Pkce {
  verifier: string
  challenge: string
  state: string
}

function authError(code: string): ApiError {
  const err = new Error(code) as ApiError
  err.code = code
  return err
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(byteLength: number): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)))
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )
  return base64UrlEncode(new Uint8Array(digest))
}

/** A 43-character verifier (32 bytes), its S256 challenge and a state. */
export async function generatePkce(): Promise<Pkce> {
  const verifier = randomBase64Url(32)
  return {
    verifier,
    challenge: await createCodeChallenge(verifier),
    state: randomBase64Url(16)
  }
}

export function buildAuthorizeUrl(params: {
  siteUrl: string
  redirectUri: string
  codeChallenge: string
  state: string
}): string {
  const url = new URL('/auth/extension', params.siteUrl)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', params.state)
  return url.toString()
}

/**
 * Reads the redirect the site sent the auth window to. Returns the code, or
 * null when the user cancelled on the site. Throws when the state doesn't
 * match or the redirect carries neither a code nor access_denied.
 */
export function parseCallbackUrl(
  responseUrl: string,
  expectedState: string
): string | null {
  let params: URLSearchParams
  try {
    params = new URL(responseUrl).searchParams
  } catch {
    throw authError('invalid_callback')
  }

  if (params.get('state') !== expectedState) {
    throw authError('state_mismatch')
  }

  const error = params.get('error')
  if (error === 'access_denied') return null
  if (error) throw authError('invalid_callback')

  const code = params.get('code')
  if (!code) throw authError('invalid_callback')
  return code
}

async function exchangeCode(code: string, verifier: string): Promise<AuthData> {
  let response: Response
  try {
    response = await apiFetch(await getApiUrl('/extension_auth/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier })
    })
  } catch {
    throw authError('request_failed')
  }

  if (!response.ok) {
    let code = 'unknown'
    try {
      const errBody = (await response.json()) as { error?: string }
      code = errBody.error ?? 'unknown'
    } catch {
      // ignore
    }
    throw authError(code)
  }

  return formatAuthData((await response.json()) as RawAuthResponse)
}

/**
 * Runs the whole flow. Resolves with the new tokens, or null when the user
 * cancelled (closed the window or chose Cancel on the site), which callers
 * should treat quietly. Throws an ApiError for anything else.
 */
export async function loginWithSite(): Promise<AuthData | null> {
  const { verifier, challenge, state } = await generatePkce()
  const url = buildAuthorizeUrl({
    siteUrl: await getSiteBaseUrl(),
    redirectUri: chrome.identity.getRedirectURL(),
    codeChallenge: challenge,
    state
  })

  let responseUrl: string | undefined
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({
      url,
      interactive: true
    })
  } catch (error) {
    if ((error as { message?: unknown })?.message === USER_CLOSED_WINDOW) {
      return null
    }
    throw authError('auth_flow_failed')
  }
  if (!responseUrl) throw authError('invalid_callback')

  const code = parseCallbackUrl(responseUrl, state)
  if (code === null) return null

  return exchangeCode(code, verifier)
}
