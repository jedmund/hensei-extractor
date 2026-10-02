import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  base64UrlEncode,
  buildAuthorizeUrl,
  createCodeChallenge,
  generatePkce,
  loginWithSite,
  parseCallbackUrl
} from './extension-auth.js'

const REDIRECT_URL = 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/'

const launchWebAuthFlow = vi.fn<(details: unknown) => Promise<string>>()
const fetchMock = vi.fn<typeof fetch>()

function tokenBody() {
  return {
    access_token: 'access-token',
    token_type: 'Bearer',
    expires_in: 7200,
    refresh_token: 'refresh-token',
    created_at: 1_700_000_000,
    user: { id: 'user-1', username: 'gran', role: 3 }
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

/** The URL the flow opened, parsed back. */
function openedUrl(): URL {
  const details = launchWebAuthFlow.mock.calls[0]![0] as { url: string }
  return new URL(details.url)
}

/** Simulates the site redirecting back with the given params. */
function redirectWith(params: (state: string) => Record<string, string>) {
  launchWebAuthFlow.mockImplementation(async (details) => {
    const state = new URL((details as { url: string }).url).searchParams.get(
      'state'
    )!
    const url = new URL(REDIRECT_URL)
    for (const [key, value] of Object.entries(params(state))) {
      url.searchParams.set(key, value)
    }
    return url.toString()
  })
}

beforeEach(() => {
  vi.stubGlobal('chrome', {
    identity: {
      getRedirectURL: () => REDIRECT_URL,
      launchWebAuthFlow
    },
    runtime: { getManifest: () => ({ version: '2.1.0' }) },
    storage: { local: { get: async () => ({ appEnv: 'production' }) } }
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('base64UrlEncode', () => {
  it('uses the URL-safe alphabet and drops padding', () => {
    // Plain base64 of these bytes is "+/8=".
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff]))).toBe('-_8')
  })
})

describe('createCodeChallenge', () => {
  it('matches the S256 example from RFC 7636', async () => {
    await expect(
      createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    ).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
})

describe('generatePkce', () => {
  it('makes a 43-character verifier, its challenge and a state', async () => {
    const pkce = await generatePkce()

    expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(pkce.challenge).toBe(await createCodeChallenge(pkce.verifier))
    expect(pkce.state).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  it('makes different values each time', async () => {
    const [a, b] = await Promise.all([generatePkce(), generatePkce()])
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.state).not.toBe(b.state)
  })
})

describe('buildAuthorizeUrl', () => {
  it('points at /auth/extension with every param', () => {
    const url = new URL(
      buildAuthorizeUrl({
        siteUrl: 'https://granblue.team',
        redirectUri: REDIRECT_URL,
        codeChallenge: 'challenge',
        state: 'state-value'
      })
    )

    expect(url.origin + url.pathname).toBe(
      'https://granblue.team/auth/extension'
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      redirect_uri: REDIRECT_URL,
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      state: 'state-value'
    })
  })
})

describe('parseCallbackUrl', () => {
  it('returns the code when the state matches', () => {
    expect(parseCallbackUrl(`${REDIRECT_URL}?code=abc&state=s1`, 's1')).toBe(
      'abc'
    )
  })

  it('rejects a mismatched state', () => {
    expect(() =>
      parseCallbackUrl(`${REDIRECT_URL}?code=abc&state=other`, 's1')
    ).toThrow(expect.objectContaining({ code: 'state_mismatch' }))
  })

  it('rejects a missing state', () => {
    expect(() => parseCallbackUrl(`${REDIRECT_URL}?code=abc`, 's1')).toThrow(
      expect.objectContaining({ code: 'state_mismatch' })
    )
  })

  it('returns null for access_denied', () => {
    expect(
      parseCallbackUrl(`${REDIRECT_URL}?error=access_denied&state=s1`, 's1')
    ).toBeNull()
  })

  it('rejects other errors and a missing code', () => {
    expect(() =>
      parseCallbackUrl(`${REDIRECT_URL}?error=server_error&state=s1`, 's1')
    ).toThrow(expect.objectContaining({ code: 'invalid_callback' }))
    expect(() => parseCallbackUrl(`${REDIRECT_URL}?state=s1`, 's1')).toThrow(
      expect.objectContaining({ code: 'invalid_callback' })
    )
  })
})

describe('loginWithSite', () => {
  it('opens the site, exchanges the code and maps the token response', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    redirectWith((state) => ({ code: 'one-time-code', state }))
    fetchMock.mockResolvedValue(jsonResponse(200, tokenBody()))

    const auth = await loginWithSite()

    expect(auth).toEqual({
      access_token: 'access-token',
      token_type: 'Bearer',
      expires_at: 1_000_000 + 7200 * 1000,
      refresh_token: 'refresh-token',
      user: { id: 'user-1', username: 'gran' }
    })

    const opened = openedUrl()
    expect(opened.origin + opened.pathname).toBe(
      'https://granblue.team/auth/extension'
    )
    expect(opened.searchParams.get('redirect_uri')).toBe(REDIRECT_URL)
    expect(opened.searchParams.get('code_challenge_method')).toBe('S256')
    expect(launchWebAuthFlow.mock.calls[0]![0]).toMatchObject({
      interactive: true
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0]!
    expect(input).toBe('https://api.granblue.team/v1/extension_auth/token')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string) as {
      code: string
      code_verifier: string
    }
    expect(body.code).toBe('one-time-code')
    // The verifier sent must be the one behind the challenge in the URL.
    expect(await createCodeChallenge(body.code_verifier)).toBe(
      opened.searchParams.get('code_challenge')
    )
    expect(new Headers(init?.headers).get('X-Extension-Version')).toBe('2.1.0')
  })

  it('fails without exchanging when the state does not match', async () => {
    redirectWith(() => ({ code: 'one-time-code', state: 'forged' }))

    await expect(loginWithSite()).rejects.toMatchObject({
      code: 'state_mismatch'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats access_denied as a quiet cancel', async () => {
    redirectWith((state) => ({ error: 'access_denied', state }))

    await expect(loginWithSite()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats a closed window as a quiet cancel', async () => {
    launchWebAuthFlow.mockRejectedValue(
      new Error('The user did not approve access.')
    )

    await expect(loginWithSite()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails when the auth page cannot be loaded', async () => {
    launchWebAuthFlow.mockRejectedValue(
      new Error('Authorization page could not be loaded.')
    )

    await expect(loginWithSite()).rejects.toMatchObject({
      code: 'auth_flow_failed'
    })
  })

  it('fails with the API error when the exchange is rejected', async () => {
    redirectWith((state) => ({ code: 'one-time-code', state }))
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_grant' }))

    await expect(loginWithSite()).rejects.toMatchObject({
      code: 'invalid_grant'
    })
  })

  it('fails when the exchange is rate limited', async () => {
    redirectWith((state) => ({ code: 'one-time-code', state }))
    fetchMock.mockResolvedValue(new Response('', { status: 429 }))

    await expect(loginWithSite()).rejects.toMatchObject({ code: 'unknown' })
  })

  it('fails when the exchange cannot reach the API', async () => {
    redirectWith((state) => ({ code: 'one-time-code', state }))
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(loginWithSite()).rejects.toMatchObject({
      code: 'request_failed'
    })
  })
})
