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

describe('handleGetCacheStatus for style shifts', () => {
  const styleList = [
    { name: 'Default Style', image: '3040377000_01', style: 1 },
    { name: 'Super Cidala', image: '3040377000_01_st2', style: 2 }
  ]
  const entry = (style?: number) => ({
    data: {
      id: '3040377000',
      name: 'Cidala',
      ...(style != null && { style }),
      style_list: styleList
    },
    timestamp: Date.now(),
    url: 'u',
    granblueId: '3040377000',
    itemName: 'Cidala'
  })

  it('lists each style of a character with its granblue ID', async () => {
    storage['gbf_cache_detail_npc_3040377000'] = entry(1)
    storage['gbf_cache_detail_npc_3040377000_style2'] = entry(2)

    const status = (await handleGetCacheStatus()) as Record<
      string,
      Record<string, unknown>
    >

    expect(status.detail_npc_3040377000).toMatchObject({
      available: true,
      granblueId: '3040377000',
      itemName: 'Cidala'
    })
    expect(status.detail_npc_3040377000).not.toHaveProperty('style')
    expect(status.detail_npc_3040377000_style2).toMatchObject({
      available: true,
      granblueId: '3040377000',
      itemName: 'Cidala',
      style: 2,
      styleName: 'Super Cidala'
    })
  })

  it('treats a payload without a style as the first style', async () => {
    storage['gbf_cache_detail_npc_3040377000'] = entry()

    const status = (await handleGetCacheStatus()) as Record<
      string,
      Record<string, unknown>
    >

    expect(status.detail_npc_3040377000).not.toHaveProperty('style')
  })

  it('loads a style-2 capture by its dataType', async () => {
    storage['gbf_cache_detail_npc_3040377000'] = entry(1)
    storage['gbf_cache_detail_npc_3040377000_style2'] = entry(2)

    const result = await handleGetCachedData('detail_npc_3040377000_style2')

    expect((result.data as { style: number }).style).toBe(2)
  })
})
