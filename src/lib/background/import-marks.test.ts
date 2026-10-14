import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../debugger.js', () => ({
  isAttached: () => false,
  getAttachedTabs: () => []
}))
vi.mock('../mastery.js', () => ({
  OVER_MASTERY_TYPE_ID: {},
  lookupAetherialTypeId: () => null,
  parseDisplayValue: () => 0
}))

import { handleGetCacheStatus } from './cache-queries.js'
import { cacheListPage, cacheParty, cacheUnfScores } from './cache-writes.js'
import { cacheCharacterStats } from './character-stats.js'
import { importedAtOf, markImported, withImportMark } from './import-marks.js'

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
            : structuredClone(storage),
        set: async (items: Record<string, unknown>) => {
          Object.assign(storage, structuredClone(items))
        }
      }
    }
  })
})

type Status = Record<string, { importedAt?: number }>

describe('withImportMark', () => {
  it('marks the capture imported when the upload succeeds', async () => {
    const now = Date.now()
    await cacheParty('1_2', { deck: { name: 'Wind' } }, now, 'url')

    const result = await withImportMark('party_1_2', async () => ({
      success: true
    }))

    expect(result).toEqual({ success: true })
    expect(storage['gbf_cache_party_1_2']).toMatchObject({
      partyName: 'Wind',
      importedCapture: now,
      importedAt: expect.any(Number)
    })
    const status = (await handleGetCacheStatus()) as unknown as Status
    expect(status.party_1_2?.importedAt).toEqual(expect.any(Number))
  })

  it('leaves the capture unmarked when the upload fails', async () => {
    await cacheParty('1_2', { deck: {} }, Date.now(), 'url')

    await withImportMark('party_1_2', async () => ({ error: 'request_failed' }))
    await withImportMark('party_1_2', async () => ({ success: false }))

    expect(storage['gbf_cache_party_1_2']).not.toHaveProperty('importedAt')
    const status = (await handleGetCacheStatus()) as unknown as Status
    expect(status.party_1_2).not.toHaveProperty('importedAt')
  })

  it('does not mark a capture that changed while it uploaded', async () => {
    await cacheParty('1_2', { deck: {} }, 100, 'url')

    await withImportMark('party_1_2', async () => {
      await cacheParty('1_2', { deck: {} }, 200, 'url')
      return { success: true }
    })

    expect(storage['gbf_cache_party_1_2']).not.toHaveProperty('importedAt')
  })

  it('does not bring back a capture cleared while it uploaded', async () => {
    await cacheParty('1_2', { deck: {} }, 100, 'url')

    await withImportMark('party_1_2', async () => {
      delete storage['gbf_cache_party_1_2']
      return { success: true }
    })

    expect(storage).toEqual({})
  })

  it('marks every page of a list as a whole', async () => {
    const now = Date.now()
    await cacheListPage('collection_npc', 1, { list: [1, 2] }, now - 1)
    await cacheListPage('collection_npc', 2, { list: [3] }, now)

    await withImportMark('collection_npc', async () => ({ success: true }))

    const status = (await handleGetCacheStatus()) as unknown as Status
    expect(status.collection_npc?.importedAt).toEqual(expect.any(Number))
  })
})

describe('a new capture clears the mark', () => {
  it('for an entry written again from scratch', async () => {
    const now = Date.now()
    await cacheParty('1_2', { deck: {} }, now - 10, 'url')
    await markImported('party_1_2', now - 10)

    await cacheParty('1_2', { deck: {} }, now, 'url')

    expect(storage['gbf_cache_party_1_2']).not.toHaveProperty('importedAt')
    const status = (await handleGetCacheStatus()) as unknown as Status
    expect(status.party_1_2).not.toHaveProperty('importedAt')
  })

  it('for a list that gains a page', async () => {
    const now = Date.now()
    await cacheListPage('list_weapon', 1, { list: [1] }, now - 10)
    await markImported('list_weapon', now - 10)

    await cacheListPage('list_weapon', 2, { list: [2] }, now)

    expect(storage['gbf_cache_list_weapon']).not.toHaveProperty('importedAt')
    const status = (await handleGetCacheStatus()) as unknown as Status
    expect(status.list_weapon).not.toHaveProperty('importedAt')
  })

  it('for crew scores that gain a page', async () => {
    const now = Date.now()
    const page = {
      member_list: {
        list: [{ id: '1', name: 'A', contribution: 1, rank: 1, level: '1' }],
        last: 2
      }
    }
    await cacheUnfScores(77, 1, page, now - 10, 'unf_scores')
    await markImported('unf_scores_77', now - 10)

    await cacheUnfScores(77, 2, page, now, 'unf_scores')

    expect(storage['gbf_cache_unf_scores_77']).not.toHaveProperty('importedAt')
  })

  it('for character stats that gain a character', async () => {
    const now = Date.now()
    await cacheCharacterStats(
      'character_detail',
      { master: { id: '3040001000' } },
      null,
      now - 10,
      'url'
    )
    await markImported('character_stats', now - 10)
    expect(
      importedAtOf(storage['gbf_cache_character_stats'])
    ).not.toBeUndefined()

    await cacheCharacterStats(
      'character_detail',
      { master: { id: '3040002000' } },
      null,
      now,
      'url'
    )

    expect(storage['gbf_cache_character_stats']).not.toHaveProperty(
      'importedAt'
    )
  })

  it('even if a writer keeps the old mark, once the capture time moves on', () => {
    expect(
      importedAtOf({ timestamp: 200, importedAt: 150, importedCapture: 100 })
    ).toBeUndefined()
    expect(
      importedAtOf({ timestamp: 100, importedAt: 150, importedCapture: 100 })
    ).toBe(150)
  })
})
