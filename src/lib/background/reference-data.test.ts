import { describe, expect, it, vi } from 'vitest'
import { authenticatedPost } from './api-client.js'
import { compareVersions, createPlaylist } from './reference-data.js'

vi.mock('./api-client.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client.js')>()),
  authenticatedPost: vi.fn()
}))

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
