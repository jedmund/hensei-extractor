import { afterEach, describe, expect, it, vi } from 'vitest'
import { authenticatedPost, parseErrorBody } from './api-client.js'
import { createPlaylist } from './reference-data.js'
import { apiFetch } from '../constants.js'

vi.mock('../constants.js', () => ({
  apiFetch: vi.fn(),
  getApiUrl: async (path: string) => `https://example.test${path}`,
  CACHE_KEYS: {},
  ELEMENT_VARIANTS_CACHE_TTL_MS: 1000,
  RAID_GROUPS_CACHE_TTL_MS: 1000
}))

const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status })

afterEach(() => vi.unstubAllGlobals())

function logIn() {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({
          gbAuth: { access_token: 'test-token', user: { username: 'test' } }
        })
      }
    }
  })
}

describe('API errors', () => {
  it('turns the actual Rails duplicate-title response into an actionable playlist error', async () => {
    logIn()
    vi.mocked(apiFetch).mockResolvedValue(
      response(422, {
        errors: { title: ['has already been taken'] }
      })
    )
    expect(await createPlaylist({ title: 'My playlist' })).toEqual({
      error: 'playlist_title_taken'
    })
  })

  it('identifies a missing playlist title', async () => {
    logIn()
    vi.mocked(apiFetch).mockResolvedValue(
      response(422, { errors: { title: ["can't be blank"] } })
    )
    expect(await createPlaylist({ title: '' })).toEqual({
      error: 'playlist_title_required'
    })
  })

  it.each([
    [401, 'invalid_token'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [408, 'request_timeout'],
    [409, 'conflict'],
    [413, 'too_large'],
    [422, 'invalid_data'],
    [429, 'rate_limited'],
    [500, 'server_error'],
    [502, 'server_error'],
    [418, 'request_rejected']
  ])('handles an empty or non-JSON %i response', async (status, error) => {
    expect(
      await parseErrorBody(
        new Response('<html>Error</html>', { status: status as number })
      )
    ).toEqual({ error })
  })

  it.each([
    null,
    [],
    'error',
    { error: { unexpected: true } },
    { errors: { title: [42] } }
  ])('handles malformed error bodies: %j', async (body) => {
    expect(await parseErrorBody(response(422, body))).toEqual({
      error: 'invalid_data'
    })
  })

  it.each([
    { error: 'not_in_crew' },
    { error: { code: 'not_in_crew' } },
    { code: 'not_in_crew' }
  ])('recognizes domain codes in supported envelopes: %j', async (body) => {
    expect(await parseErrorBody(response(422, body))).toEqual({
      error: 'not_in_crew'
    })
  })

  it('preserves per-item errors used to identify unknown support summons', async () => {
    const errors = [{ error: 'Summon not found', granblue_id: '2049999000' }]
    expect(await parseErrorBody(response(422, { errors }))).toEqual({
      error: 'invalid_data',
      errors
    })
  })

  it('does not expose server exception messages or confuse them with connection failures', async () => {
    expect(
      await parseErrorBody(response(500, { error: 'database credentials' }))
    ).toEqual({ error: 'server_error' })
    expect(
      await parseErrorBody(
        response(422, { errors: { message: 'internal exception' } })
      )
    ).toEqual({ error: 'invalid_data', message: 'internal exception' })
  })

  it('distinguishes network failures from rejected requests', async () => {
    logIn()
    vi.mocked(apiFetch).mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await authenticatedPost('/playlists', {})).toEqual({
      error: 'request_failed'
    })
  })
})

function respond(body: unknown) {
  return response(422, body)
}
describe('internal domain error details', () => {
  it('reads a rescued validation failure', async () => {
    const message = 'Validation failed: Granblue crew has already been taken'
    await expect(
      parseErrorBody(respond({ errors: { message } }))
    ).resolves.toEqual({ error: 'invalid_data', message })
  })

  it('reads a domain error code', async () => {
    await expect(
      parseErrorBody(
        respond({ message: 'Already in a crew', code: 'already_in_crew' })
      )
    ).resolves.toEqual({
      error: 'already_in_crew',
      message: 'Already in a crew'
    })
  })
})
