import { describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../constants.js'
import { authenticatedPost, getAuthToken } from './api-client.js'
import {
  compareVersions,
  createPlaylist,
  fetchUserPlaylists,
  getCollectionIds
} from './reference-data.js'

vi.mock('./api-client.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client.js')>()),
  authenticatedPost: vi.fn(),
  getAuthToken: vi.fn()
}))
vi.mock('../constants.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../constants.js')>()),
  apiFetch: vi.fn(async () => new Response('{}', { status: 200 })),
  getApiUrl: async (path: string) => `https://api.test/v1${path}`
}))

const AWKWARD = 'a/b?c#d e'

describe('user paths', () => {
  it('encodes the username and user id as single path segments', async () => {
    vi.mocked(getAuthToken).mockResolvedValue({
      access_token: 'token',
      user: { id: AWKWARD, username: AWKWARD }
    })

    await fetchUserPlaylists()
    await getCollectionIds()

    const urls = vi.mocked(apiFetch).mock.calls.map(([url]) => String(url))
    expect(urls).toEqual([
      'https://api.test/v1/users/a%2Fb%3Fc%23d%20e/playlists?per_page=100',
      'https://api.test/v1/users/a%2Fb%3Fc%23d%20e/collection/game_ids'
    ])
  })
})

describe('createPlaylist', () => {
  it('unwraps the playlist from the API response', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({
      data: { playlist: { id: 'abc', title: 'Farming' } }
    } as never)

    const res = await createPlaylist({ title: 'Farming' })

    expect(res).toEqual({ data: { id: 'abc', title: 'Farming' } })
  })

  it('reports an error when the response has no playlist id', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({ data: {} } as never)

    const res = await createPlaylist({ title: 'Farming' })

    expect(res).toEqual({ error: 'request_failed' })
  })
})

describe('compareVersions', () => {
  it.each([
    ['1.2.3', '1.2.3', 0],
    ['1.2', '1.2.0', 0],
    ['1.2.4', '1.2.3', 1],
    ['1.10.0', '1.9.9', 1],
    ['2.0.0', '10.0.0', -1]
  ])('compares %s with %s', (left, right, expected) => {
    expect(compareVersions(left, right)).toBe(expected)
  })
})
