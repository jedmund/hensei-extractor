import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../debugger.js', () => ({
  isAttached: () => false,
  getAttachedTabs: () => []
}))

import { CACHE_TTL_MS } from '../constants.js'
import { handleGetCacheStatus } from './cache-queries.js'

let storage: Record<string, unknown>

beforeEach(() => {
  storage = {}
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async () => structuredClone(storage)
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
})
