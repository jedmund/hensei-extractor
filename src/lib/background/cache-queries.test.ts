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
  it('expires expedition reports like other captures', async () => {
    const timestamp = Date.now() - CACHE_TTL_MS * 100
    storage['gbf_cache_solomonis_run_405483'] = {
      reportId: '405483',
      deckName: 'Nier Party 1',
      evokerId: '3040168000',
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
      available: false,
      isStale: true,
      evokerId: '3040168000'
    })
    expect(status.party_1_1).toMatchObject({ available: false, isStale: true })
  })

  it('lists expedition reports captured within the last 30 minutes', async () => {
    const timestamp = Date.now() - CACHE_TTL_MS / 2
    storage['gbf_cache_solomonis_run_405483'] = {
      reportId: '405483',
      hasReport: true,
      hasBook: false,
      timestamp
    }

    const status = (await handleGetCacheStatus()) as Record<string, unknown>

    expect(status.solomonis_run_405483).toMatchObject({
      available: true,
      isStale: false,
      lastUpdated: timestamp,
      reportId: '405483'
    })
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
  it('opens expedition reports captured within the last 30 minutes', async () => {
    storage['gbf_cache_solomonis_run_405483'] = {
      data: { reportId: '405483' },
      timestamp: Date.now() - CACHE_TTL_MS / 2
    }

    expect(await handleGetCachedData('solomonis_run_405483')).toMatchObject({
      data: { reportId: '405483' }
    })
  })

  it('opens old Solomonis decks, but not old reports or other captures', async () => {
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

    expect(await handleGetCachedData('solomonis_run_405483')).toEqual({
      error: 'stale_data'
    })
    expect(await handleGetCachedData('solomonis_deck_31001')).toMatchObject({
      data: { deck: {} }
    })
    expect(await handleGetCachedData('party_1_1')).toEqual({
      error: 'stale_data'
    })
  })
})
