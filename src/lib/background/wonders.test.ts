import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '../__fixtures__/memorial-list-en.json'
import ja from '../__fixtures__/memorial-list-ja.json'
import { authenticatedPost, getAuthToken } from './api-client.js'
import { createCaptureHandler, type CaptureDependencies } from './capture.js'
import { cacheWonders, uploadWonders, wondersLanguage } from './wonders.js'

vi.mock('./api-client.js', () => ({
  authenticatedPost: vi.fn(),
  getAuthToken: vi.fn(async () => null)
}))
vi.mock('../mastery.js', () => ({
  OVER_MASTERY_TYPE_ID: {},
  lookupAetherialTypeId: () => null,
  parseDisplayValue: () => 0
}))

const UID = '12345678'
const URL = `https://game.granbluefantasy.jp/item/memorial_list/1?_=1700000000000&t=1700000000123&uid=${UID}`
const set = vi.fn(async (_items: Record<string, unknown>) => undefined)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('chrome', { storage: { local: { set } } })
})

describe('cacheWonders', () => {
  it('caches the response body with a count of its Wonders', async () => {
    await expect(cacheWonders(en, 100)).resolves.toBe(true)
    expect(set).toHaveBeenCalledWith({
      gbf_cache_wonders: { data: en, timestamp: 100, totalItems: 51 }
    })
  })

  it('ignores a response that is not the Wonders list', async () => {
    await expect(cacheWonders({ error: 'x' }, 100)).resolves.toBe(false)
    expect(set).not.toHaveBeenCalled()
  })

  it('keeps no URL, uid or headers when captured', async () => {
    const handler = createCaptureHandler({
      cacheWonders,
      notifyCaptured: vi.fn(async () => undefined)
    } as unknown as CaptureDependencies)

    await handler(
      URL,
      en,
      'wonders',
      {
        pageNumber: null,
        partyId: null,
        masterId: null,
        stashNumber: null,
        stashName: null,
        eventNumber: null,
        reportId: null
      },
      100
    )

    expect(set).toHaveBeenCalledTimes(1)
    const entry = set.mock.calls[0]![0].gbf_cache_wonders as Record<
      string,
      unknown
    >
    expect(Object.keys(entry).sort()).toEqual([
      'data',
      'timestamp',
      'totalItems'
    ])
    expect(entry.data).toBe(en)
    const stored = JSON.stringify(entry)
    expect(stored).not.toContain(UID)
    expect(stored).not.toContain('memorial_list')
    expect(stored.toLowerCase()).not.toContain('cookie')
  })
})

describe('wondersLanguage', () => {
  it('reads the language from the captured text', async () => {
    await expect(wondersLanguage(en)).resolves.toBe('en')
    await expect(wondersLanguage(ja)).resolves.toBe('ja')
  })

  it('falls back to the account language when there is no text', async () => {
    vi.mocked(getAuthToken).mockResolvedValueOnce({
      access_token: 't',
      user: { id: '1', username: 'u' },
      language: 'ja'
    })
    await expect(wondersLanguage([{ category_id: '1' }])).resolves.toBe('ja')
  })
})

describe('uploadWonders', () => {
  it('sends the response array and its language to the import', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({
      data: {
        success: true,
        created: 3,
        updated: 10,
        skipped: [
          { granblue_id: '9999', name: 'Not In Catalogue', reason: 'x' }
        ],
        warnings: []
      }
    })

    await expect(uploadWonders(ja)).resolves.toEqual({
      success: true,
      created: 3,
      updated: 10,
      skipped: 1
    })
    expect(authenticatedPost).toHaveBeenCalledWith(
      '/collection/wonders/import',
      { data: ja, lang: 'ja' }
    )
  })

  it('sends English captures as en', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({ data: { created: 0 } })

    await uploadWonders(en)
    const body = vi.mocked(authenticatedPost).mock.calls[0]![1]
    expect(body).toEqual({ data: en, lang: 'en' })
  })

  it('passes API errors through', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({ error: 'invalid_token' })
    await expect(uploadWonders(en)).resolves.toEqual({
      error: 'invalid_token'
    })
  })

  it('sends nothing without a captured list', async () => {
    await expect(uploadWonders([])).resolves.toEqual({ error: 'no_items' })
    await expect(uploadWonders(null)).resolves.toEqual({ error: 'no_items' })
    expect(authenticatedPost).not.toHaveBeenCalled()
  })
})
