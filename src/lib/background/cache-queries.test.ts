import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../debugger.js', () => ({
  isAttached: () => false,
  getAttachedTabs: () => []
}))

import { CACHE_TTL_MS } from '../constants.js'
import { handleGetCachedData, handleGetCacheStatus } from './cache-queries.js'

let storage: Record<string, unknown>

beforeEach(() => {
  storage = {}
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key?: string | null) =>
          typeof key === 'string'
            ? key in storage
              ? { [key]: structuredClone(storage[key]) }
              : {}
            : structuredClone(storage)
      }
    }
  })
})

describe('handleGetCacheStatus', () => {
  it('keeps old expedition reports importable', async () => {
    const timestamp = Date.now() - CACHE_TTL_MS * 100
    storage['gbf_cache_solomonis_run_405483'] = {
      reportId: '405483',
      deckName: 'Nier Party 1',
      hasReport: true,
      hasBook: true,
      timestamp
    }
    storage['gbf_cache_party_1_1'] = { partyName: 'Party', timestamp }

    const status = (await handleGetCacheStatus()) as Record<
      string,
      { available?: boolean; isStale?: boolean }
    >

    expect(status.solomonis_run_405483).toMatchObject({
      available: true,
      isStale: false
    })
    expect(status.party_1_1).toMatchObject({ available: false, isStale: true })
  })

  it('lists captured Solomonis decks with their Evoker, kept until cleared', async () => {
    const timestamp = Date.now() - CACHE_TTL_MS * 100
    storage['gbf_cache_solomonis_deck_31001'] = {
      data: { deck: { priority: 31001 } },
      timestamp,
      priority: '31001',
      deckName: 'Fraux Party 1',
      evokerId: '3040161000',
      evokerName: 'Fraux'
    }

    const status = (await handleGetCacheStatus()) as Record<string, unknown>

    expect(status.solomonis_deck_31001).toMatchObject({
      available: true,
      isStale: false,
      lastUpdated: timestamp,
      partyName: 'Fraux Party 1',
      evokerId: '3040161000',
      evokerName: 'Fraux'
    })
  })
})

describe('handleGetCachedData', () => {
  it('opens old Solomonis reports and decks, but not other old captures', async () => {
    const timestamp = Date.now() - CACHE_TTL_MS * 100
    storage['gbf_cache_solomonis_run_405483'] = {
      data: { reportId: '405483' },
      timestamp
    }
    storage['gbf_cache_solomonis_deck_31001'] = {
      data: { deck: {} },
      timestamp
    }
    storage['gbf_cache_party_1_1'] = { data: { deck: {} }, timestamp }

    expect(await handleGetCachedData('solomonis_run_405483')).toMatchObject({
      data: { reportId: '405483' }
    })
    expect(await handleGetCachedData('solomonis_deck_31001')).toMatchObject({
      data: { deck: {} }
    })
    expect(await handleGetCachedData('party_1_1')).toEqual({
      error: 'stale_data'
    })
  })
})
