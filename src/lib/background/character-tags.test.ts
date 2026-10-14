import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toCharacterTagData } from './character-tags.js'

describe('toCharacterTagData', () => {
  it('keeps the fields CharacterTags shows', () => {
    expect(
      toCharacterTagData({
        granblue_id: '3040652000',
        element: 4,
        season: 3,
        style_swap: false,
        series: [
          { id: 'x', slug: 'summer', name: { en: 'Summer', ja: '水着' } }
        ],
        name: { en: 'Felluca' }
      })
    ).toEqual({
      element: 4,
      season: 3,
      series: [{ name: { en: 'Summer', ja: '水着' } }],
      styleSwap: false
    })
  })

  it('drops legacy numeric series and missing fields', () => {
    expect(toCharacterTagData({ series: [3], style_swap: true })).toEqual({
      element: null,
      season: null,
      series: [],
      styleSwap: true
    })
    expect(toCharacterTagData(null)).toBeNull()
  })
})

describe('fetchCharacterTags', () => {
  let storage: Record<string, unknown>
  let responses: Record<string, () => Response | Promise<Response>>

  beforeEach(() => {
    vi.resetModules()
    storage = {}
    responses = {}
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string) =>
            key in storage ? { [key]: structuredClone(storage[key]) } : {}
          ),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(storage, structuredClone(items))
          })
        }
      }
    })
    vi.doMock('../constants.js', () => ({
      getApiUrl: async (endpoint: string) => `https://api.test${endpoint}`,
      apiFetch: vi.fn(async (url: string) => {
        const id = url.split('/').pop() ?? ''
        const respond = responses[id]
        if (!respond) throw new Error('network down')
        return respond()
      })
    }))
  })

  afterEach(() => {
    vi.doUnmock('../constants.js')
    vi.unstubAllGlobals()
  })

  const json = (body: unknown) => () =>
    new Response(JSON.stringify(body), { status: 200 })
  const status = (code: number) => () => new Response(null, { status: code })
  const cache = () =>
    storage.characterTagCache as Record<string, { data: unknown }>

  it('caches a 404 as null', async () => {
    responses['3040000000'] = status(404)
    const { fetchCharacterTags } = await import('./character-tags.js')
    expect(await fetchCharacterTags(['3040000000'])).toEqual({
      '3040000000': null
    })
    expect(cache()['3040000000']?.data).toBeNull()
  })

  it("doesn't cache network errors, 429s or 5xx", async () => {
    responses['3040000001'] = status(429)
    responses['3040000002'] = status(503)
    const { fetchCharacterTags } = await import('./character-tags.js')
    expect(
      await fetchCharacterTags(['3040000001', '3040000002', '3040000003'])
    ).toEqual({ '3040000001': null, '3040000002': null, '3040000003': null })
    expect(storage.characterTagCache).toBeUndefined()

    responses['3040000001'] = json({ element: 2 })
    const retried = await fetchCharacterTags(['3040000001'])
    expect(retried['3040000001']?.element).toBe(2)
  })

  it("keeps both calls' entries when lookups overlap", async () => {
    let releaseFirst: () => void = () => {}
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    responses['3040000010'] = async () => {
      await firstGate
      return json({ element: 1 })()
    }
    responses['3040000020'] = json({ element: 3 })
    const { fetchCharacterTags } = await import('./character-tags.js')

    const first = fetchCharacterTags(['3040000010'])
    await fetchCharacterTags(['3040000020'])
    releaseFirst()
    await first

    expect(Object.keys(cache()).sort()).toEqual(['3040000010', '3040000020'])
  })
})
