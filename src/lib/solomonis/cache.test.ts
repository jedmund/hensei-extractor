import { beforeEach, describe, expect, it, vi } from 'vitest'
import detailResponse from './__fixtures__/report-detail.json'
import spacebookResponse from './__fixtures__/report-spacebook.json'
import deckResponse from './__fixtures__/party-deck.json'
import {
  cacheSolomonisDeck,
  cacheSolomonisReport,
  solomonisRunCacheKey
} from './cache.js'
import type {
  SolomonisDeckCacheEntry,
  SolomonisRunCacheEntry
} from './types.js'

vi.mock('../constants.js', () => ({
  CACHE_PREFIXES: {
    solomonis_run: 'gbf_cache_solomonis_run_',
    solomonis_deck: 'gbf_cache_solomonis_deck_'
  }
}))

let storage: Record<string, unknown>

beforeEach(() => {
  storage = {}
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
})

const KEY = 'gbf_cache_solomonis_run_381099'

function stored(): SolomonisRunCacheEntry {
  return storage[KEY] as SolomonisRunCacheEntry
}

describe('cacheSolomonisReport', () => {
  it('uses one key per report', () => {
    expect(solomonisRunCacheKey('381099')).toBe(KEY)
  })

  it('pairs both logs of a report in one entry', async () => {
    expect(
      await cacheSolomonisReport(
        'solomonis_report',
        '381099',
        detailResponse,
        10
      )
    ).toBe('solomonis_run_381099')
    expect(stored()).toMatchObject({
      reportId: '381099',
      deckName: 'Nier Party',
      evokerId: '3040169000',
      hasReport: true,
      hasBook: false,
      timestamp: 10
    })

    expect(
      await cacheSolomonisReport(
        'solomonis_report_book',
        '381099',
        spacebookResponse,
        20
      )
    ).toBe('solomonis_run_381099')
    expect(stored()).toMatchObject({
      hasReport: true,
      hasBook: true,
      timestamp: 20
    })
    expect(stored().data.statusList).toEqual(spacebookResponse.status_list)
    expect(stored().data.report?.dungeon_report_id).toBe(381099)
  })

  it('keeps both halves when the two logs arrive together', async () => {
    await Promise.all([
      cacheSolomonisReport('solomonis_report', '381099', detailResponse, 10),
      cacheSolomonisReport(
        'solomonis_report_book',
        '381099',
        spacebookResponse,
        11
      )
    ])
    expect(stored()).toMatchObject({ hasReport: true, hasBook: true })
  })

  it('never stores langMsg, display_list, the HTML data or a URL', async () => {
    await cacheSolomonisReport('solomonis_report', '381099', detailResponse, 10)
    const json = JSON.stringify(storage)
    expect(json).not.toContain('langMsg')
    expect(json).not.toContain('display_list')
    expect(json).not.toContain('user_id')
    expect(json).not.toContain('%3Cdiv')
    expect(json).not.toMatch(/uid=|"uid"/)
    expect(json).not.toContain('"url"')
  })

  it('keeps reports apart by ID', async () => {
    await cacheSolomonisReport('solomonis_report', '381099', detailResponse, 10)
    await cacheSolomonisReport(
      'solomonis_report_book',
      '405483',
      spacebookResponse,
      20
    )
    expect(stored()).toMatchObject({ hasReport: true, hasBook: false })
    expect(storage['gbf_cache_solomonis_run_405483']).toMatchObject({
      hasReport: false,
      hasBook: true
    })
  })

  it('ignores responses without a report ID or anything to keep', async () => {
    expect(
      await cacheSolomonisReport('solomonis_report', null, detailResponse, 10)
    ).toBeNull()
    expect(
      await cacheSolomonisReport('solomonis_report', '1', { data: '' }, 10)
    ).toBeNull()
    expect(
      await cacheSolomonisReport('solomonis_report_book', '1', {}, 10)
    ).toBeNull()
    expect(storage).toEqual({})
  })
})

describe('cacheSolomonisDeck', () => {
  const DECK_KEY = 'gbf_cache_solomonis_deck_31001'

  it('keys the deck by its priority and keeps the Evoker for pairing', async () => {
    expect(await cacheSolomonisDeck(deckResponse, 10)).toBe(
      'solomonis_deck_31001'
    )
    const entry = storage[DECK_KEY] as SolomonisDeckCacheEntry
    expect(entry).toMatchObject({
      timestamp: 10,
      priority: '31001',
      deckName: 'Fraux Party 1',
      evokerId: '3040161000',
      evokerName: 'Fraux'
    })
    expect(entry.data.deck.dungeon_name).toBe('Allotropic Microcosm')
  })

  it("never stores the player's uid or a URL", async () => {
    await cacheSolomonisDeck(deckResponse, 10)
    const json = JSON.stringify(storage)
    expect(json).not.toContain('12345678')
    expect(json).not.toMatch(/uid=|"uid"|"url"|\?_=/)
    const entry = storage[DECK_KEY] as SolomonisDeckCacheEntry
    expect(entry.data.deck.pc?.param).not.toHaveProperty('id')
  })

  it('replaces an earlier capture of the same deck', async () => {
    await cacheSolomonisDeck(deckResponse, 10)
    await cacheSolomonisDeck(
      { deck: { ...deckResponse.deck, name: 'Renamed' } },
      20
    )
    expect(storage[DECK_KEY]).toMatchObject({
      deckName: 'Renamed',
      timestamp: 20
    })
    expect(Object.keys(storage)).toEqual([DECK_KEY])
  })

  it('ignores responses without a deck priority', async () => {
    expect(await cacheSolomonisDeck({ deck: { name: 'x' } }, 10)).toBeNull()
    expect(await cacheSolomonisDeck(null, 10)).toBeNull()
    expect(storage).toEqual({})
  })
})
