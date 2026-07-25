import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCaptureHandler, type CaptureDependencies } from './capture.js'

vi.mock('../mastery.js', () => ({
  OVER_MASTERY_TYPE_ID: {},
  lookupAetherialTypeId: () => null,
  PERPETUITY_TYPE_ID: {},
  parseDisplayValue: () => 0
}))

const metadata = {
  pageNumber: 2,
  partyId: null,
  masterId: null,
  stashNumber: null,
  stashName: null,
  eventNumber: null
}

function createDependencies(): CaptureDependencies {
  return {
    cacheParty: vi.fn(async () => true),
    cacheCharacterStats: vi.fn(async () => true),
    cacheListPage: vi.fn(async () => true),
    cacheDetailItem: vi.fn(async () => ({
      dataType: 'detail_weapon_1040001',
      cached: true
    })),
    cacheUnfScores: vi.fn(async () => true),
    cacheGuildInfo: vi.fn(async () => true),
    cacheSingleItem: vi.fn(async () => true),
    notifyCaptured: vi.fn(async () => undefined)
  }
}

describe('capture dispatcher', () => {
  let dependencies: CaptureDependencies

  beforeEach(() => {
    dependencies = createDependencies()
  })

  it('caches parties and emits their dynamic data type', async () => {
    const handler = createCaptureHandler(dependencies)
    const data = { deck: { name: 'Wind' } }

    await handler(
      'https://game/party/deck/1/2',
      data,
      'party',
      { ...metadata, partyId: '1_2' },
      100
    )

    expect(dependencies.cacheParty).toHaveBeenCalledWith(
      '1_2',
      data,
      100,
      'https://game/party/deck/1/2'
    )
    expect(dependencies.notifyCaptured).toHaveBeenCalledWith({
      action: 'dataCaptured',
      dataType: 'party_1_2',
      pageNumber: 2,
      timestamp: 100
    })
  })

  it('routes stash and UNF pages with their dynamic cache metadata', async () => {
    const handler = createCaptureHandler(dependencies)
    const stashData = { list: ['weapon'] }

    await handler(
      'https://game/weapon/container_list',
      stashData,
      'stash_weapon',
      {
        ...metadata,
        stashNumber: '3',
        stashName: 'Reserve'
      },
      200
    )

    expect(dependencies.cacheListPage).toHaveBeenCalledWith(
      'stash_weapon',
      2,
      stashData,
      200,
      'gbf_cache_stash_weapon_3',
      'Reserve'
    )

    await handler(
      'https://game/teamraid/total_performance/2',
      { member_list: {} },
      'unf_scores',
      { ...metadata, eventNumber: 77 },
      300
    )

    expect(dependencies.cacheUnfScores).toHaveBeenCalledWith(
      77,
      2,
      { member_list: {} },
      300,
      'unf_scores'
    )
    expect(dependencies.notifyCaptured).toHaveBeenLastCalledWith({
      action: 'dataCaptured',
      dataType: 'unf_scores_77',
      pageNumber: 2,
      timestamp: 300
    })
  })

  it('also merges database character details into character stats', async () => {
    const handler = createCaptureHandler(dependencies)
    const data = { master: { id: '3040001' } }
    vi.mocked(dependencies.cacheDetailItem).mockResolvedValue({
      dataType: 'detail_npc_3040001',
      cached: true
    })

    await handler(
      'https://game/archive/npc_detail/3040001',
      data,
      'detail_npc',
      metadata,
      400
    )

    expect(dependencies.cacheDetailItem).toHaveBeenCalled()
    expect(dependencies.cacheCharacterStats).toHaveBeenCalledWith(
      'character_detail',
      data,
      '3040001',
      400,
      'https://game/archive/npc_detail/3040001'
    )
    expect(dependencies.notifyCaptured).toHaveBeenCalledWith({
      action: 'dataCaptured',
      dataType: 'detail_npc_3040001',
      pageNumber: 2,
      timestamp: 400
    })
  })

  it.each([
    [
      'character_detail',
      { master: { id: '3040001' } },
      { ...metadata, masterId: '3040001' },
      'cacheCharacterStats',
      [
        'character_detail',
        { master: { id: '3040001' } },
        '3040001',
        700,
        'https://game/data'
      ],
      'character_stats'
    ],
    [
      'list_weapon',
      { list: ['weapon'] },
      metadata,
      'cacheListPage',
      ['list_weapon', 2, { list: ['weapon'] }, 700],
      'list_weapon'
    ],
    [
      'guild_info',
      { is_guild_in: '99' },
      metadata,
      'cacheGuildInfo',
      [{ is_guild_in: '99' }, 700],
      'guild_info'
    ],
    [
      'other',
      { value: true },
      metadata,
      'cacheSingleItem',
      ['other', { value: true }, 700, 'https://game/data'],
      'other'
    ]
  ])(
    'routes %s through %s',
    async (
      dataType,
      data,
      captureMetadata,
      dependencyName,
      expectedArguments,
      emittedDataType
    ) => {
      const handler = createCaptureHandler(dependencies)

      await handler('https://game/data', data, dataType, captureMetadata, 700)

      expect(
        dependencies[dependencyName as keyof CaptureDependencies]
      ).toHaveBeenCalledWith(...expectedArguments)
      expect(dependencies.notifyCaptured).toHaveBeenCalledWith({
        action: 'dataCaptured',
        dataType: emittedDataType,
        pageNumber: 2,
        timestamp: 700
      })
    }
  )

  it('does not emit when data is ignored or the cache writer declines it', async () => {
    const handler = createCaptureHandler(dependencies)

    await handler('https://game/unknown', {}, 'unknown', metadata, 500)

    vi.mocked(dependencies.cacheListPage).mockResolvedValue(false)
    await handler(
      'https://game/rest/weapon/list/1',
      { list: [] },
      'collection_weapon',
      metadata,
      600
    )

    expect(dependencies.notifyCaptured).not.toHaveBeenCalled()
  })
})
