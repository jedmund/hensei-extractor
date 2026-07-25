import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMessageListener,
  type MessageRouterDependencies
} from './message-router.js'

function createDependencies(): MessageRouterDependencies {
  return {
    checkExtensionVersion: vi.fn(async () => null),
    handleGetCacheStatus: vi.fn(async () => ({ _debugger: {} })),
    handleGetCachedData: vi.fn(async () => ({})),
    handleClearCache: vi.fn(async () => ({ success: true })),
    isAttached: vi.fn(() => true),
    getAttachedTabs: vi.fn(() => [10]),
    handlePopOutWindow: vi.fn(() => true),
    fetchRaidGroups: vi.fn(async () => ({})),
    fetchElementVariants: vi.fn(async () => ({})),
    fetchUserPlaylists: vi.fn(async () => ({})),
    createPlaylist: vi.fn(async () => ({})),
    loadCachedDataForUpload: vi.fn(async () => ({ 1: { list: ['item'] } })),
    uploadPartyData: vi.fn(async () => ({})),
    uploadDetailData: vi.fn(async () => ({})),
    getCollectionIds: vi.fn(async () => ({})),
    checkConflicts: vi.fn(async () => ({})),
    checkCollectionUpdates: vi.fn(async () => ({})),
    checkCharacterStatsUpdates: vi.fn(async () => ({})),
    uploadCollectionData: vi.fn(async () => ({})),
    previewSyncDeletions: vi.fn(async () => ({})),
    uploadCharacterStats: vi.fn(async () => ({})),
    handleUploadUnfScores: vi.fn(async () => ({})),
    handleCreateCrew: vi.fn(async () => ({})),
    handlePreviewGwPhantoms: vi.fn(async () => ({})),
    handleFetchLatestGwEvent: vi.fn(async () => ({}))
  } as unknown as MessageRouterDependencies
}

describe('background message router', () => {
  let dependencies: MessageRouterDependencies
  let sendResponse: ReturnType<typeof vi.fn>

  beforeEach(() => {
    dependencies = createDependencies()
    sendResponse = vi.fn()
  })

  it.each([
    ['checkExtensionVersion', 'checkExtensionVersion', {}, []],
    ['getCacheStatus', 'handleGetCacheStatus', {}, []],
    [
      'getCachedData',
      'handleGetCachedData',
      { dataType: 'list_npc' },
      ['list_npc']
    ],
    ['clearCache', 'handleClearCache', {}, [undefined]],
    ['fetchRaidGroups', 'fetchRaidGroups', { forceRefresh: true }, [true]],
    [
      'fetchElementVariants',
      'fetchElementVariants',
      { forceRefresh: false },
      [false]
    ],
    ['fetchUserPlaylists', 'fetchUserPlaylists', {}, []],
    [
      'createPlaylist',
      'createPlaylist',
      { data: { title: 'Favorites', description: '', visibility: 3 } },
      [{ title: 'Favorites', description: '', visibility: 3 }]
    ],
    ['getCollectionIds', 'getCollectionIds', {}, []],
    [
      'uploadUnfScores',
      'handleUploadUnfScores',
      { dataType: 'unf_scores_77', round: 'finals_1' },
      ['unf_scores_77', 'finals_1']
    ],
    ['createCrew', 'handleCreateCrew', { name: 'Skyfarers' }, ['Skyfarers']],
    [
      'previewGwPhantoms',
      'handlePreviewGwPhantoms',
      { dataType: 'unf_scores_77' },
      ['unf_scores_77']
    ],
    ['fetchLatestGwEvent', 'handleFetchLatestGwEvent', {}, []]
  ])(
    'routes %s to %s',
    async (action, dependencyName, fields, expectedArguments) => {
      const listener = createMessageListener(dependencies)

      const keepAlive = listener(
        { action, ...fields },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )

      expect(keepAlive).toBe(true)
      expect(
        dependencies[dependencyName as keyof MessageRouterDependencies]
      ).toHaveBeenCalledWith(...expectedArguments)
      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
    }
  )

  it('responds synchronously to debugger status and ignores unknown actions', () => {
    const listener = createMessageListener(dependencies)

    expect(
      listener(
        { action: 'getDebuggerStatus' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
    ).toBe(false)
    expect(sendResponse).toHaveBeenCalledWith({
      attached: true,
      tabs: [10]
    })

    expect(
      listener(
        { action: 'notReal' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
    ).toBe(false)
  })

  it('delegates pop-out response lifetime to the window manager', () => {
    vi.mocked(dependencies.handlePopOutWindow).mockReturnValue(false)
    const listener = createMessageListener(dependencies)

    expect(
      listener(
        { action: 'popOutWindow' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
    ).toBe(false)
    expect(dependencies.handlePopOutWindow).toHaveBeenCalledWith(sendResponse)
  })

  it('returns no_cached_data before invoking an upload handler', async () => {
    vi.mocked(dependencies.loadCachedDataForUpload).mockResolvedValue(null)
    const listener = createMessageListener(dependencies)

    expect(
      listener(
        { action: 'uploadDetailData', dataType: 'detail_npc_3040001' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      )
    ).toBe(true)

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ error: 'no_cached_data' })
    )
    expect(dependencies.uploadDetailData).not.toHaveBeenCalled()
  })

  it('forwards party import metadata after loading cached data', async () => {
    const cachedData = { deck: { name: 'Wind' } }
    vi.mocked(dependencies.loadCachedDataForUpload).mockResolvedValue(
      cachedData
    )
    const listener = createMessageListener(dependencies)

    listener(
      {
        action: 'uploadPartyData',
        dataType: 'party_1_2',
        raidId: '42',
        playlistIds: ['7'],
        name: 'Wind',
        visibility: 3,
        shareWithCrew: true
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    )

    await vi.waitFor(() =>
      expect(dependencies.uploadPartyData).toHaveBeenCalledWith(
        cachedData,
        '42',
        ['7'],
        'Wind',
        3,
        true
      )
    )
  })

  it.each([
    [
      'uploadDetailData',
      { dataType: 'detail_npc_3040001' },
      'detail_npc_3040001',
      'uploadDetailData',
      [{ 1: { list: ['item'] } }, 'detail_npc_3040001']
    ],
    [
      'checkCollectionUpdates',
      { dataType: 'collection_npc' },
      'collection_npc',
      'checkCollectionUpdates',
      [{ 1: { list: ['item'] } }, 'collection_npc']
    ],
    [
      'checkCharacterStatsUpdates',
      {},
      'character_stats',
      'checkCharacterStatsUpdates',
      [{ 1: { list: ['item'] } }]
    ],
    [
      'previewSyncDeletions',
      { dataType: 'collection_summon' },
      'collection_summon',
      'previewSyncDeletions',
      [{ 1: { list: ['item'] } }, 'collection_summon']
    ],
    [
      'uploadCharacterStats',
      { selectedIndices: [0] },
      'character_stats',
      'uploadCharacterStats',
      [{ 1: { list: ['item'] } }]
    ]
  ])(
    'routes cached action %s after loading %s',
    async (action, fields, cacheKey, dependencyName, expectedArguments) => {
      const listener = createMessageListener(dependencies)

      expect(
        listener(
          { action, ...fields },
          {} as chrome.runtime.MessageSender,
          sendResponse
        )
      ).toBe(true)

      expect(dependencies.loadCachedDataForUpload).toHaveBeenCalledWith(
        cacheKey
      )
      await vi.waitFor(() =>
        expect(
          dependencies[dependencyName as keyof MessageRouterDependencies]
        ).toHaveBeenCalledWith(...expectedArguments)
      )
    }
  )

  it('preserves collection upload options and current selection quirks', async () => {
    const pages = { 1: { list: ['a', 'b'] } }
    vi.mocked(dependencies.loadCachedDataForUpload).mockResolvedValue(pages)
    const listener = createMessageListener(dependencies)

    listener(
      {
        action: 'uploadCollectionData',
        dataType: 'collection_weapon',
        selectedIndices: [1],
        conflictResolutions: { a: 'skip' },
        deletionIds: ['old']
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    )

    await vi.waitFor(() =>
      expect(dependencies.uploadCollectionData).toHaveBeenCalledWith(
        pages,
        'collection_weapon',
        {
          selectedIndices: [1],
          conflictResolutions: { a: 'skip' },
          deletionIds: ['old']
        }
      )
    )

    listener(
      {
        action: 'checkConflicts',
        dataType: 'collection_weapon',
        selectedIndices: [1]
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    )

    await vi.waitFor(() =>
      expect(dependencies.checkConflicts).toHaveBeenCalledWith(
        pages,
        'collection_weapon'
      )
    )

    listener(
      {
        action: 'syncCollection',
        dataType: 'collection_weapon',
        selectedIndices: [0],
        deletionIds: ['gone']
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    )

    await vi.waitFor(() =>
      expect(dependencies.uploadCollectionData).toHaveBeenLastCalledWith(
        pages,
        'collection_weapon',
        {
          selectedIndices: [0],
          isFullInventory: true,
          reconcileDeletions: true,
          deletionIds: ['gone']
        }
      )
    )
  })
})
