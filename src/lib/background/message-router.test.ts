import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ExtensionMessage } from '../types/messages.js'
import { loadCachedDataForUpload } from './cache-queries.js'
import * as collections from './collections.js'
import * as crew from './crew.js'
import * as referenceData from './reference-data.js'
import * as apiClient from './api-client.js'
import * as cacheQueries from './cache-queries.js'
import {
  createHandlers,
  createMessageListener,
  type MessageHandlers
} from './message-router.js'

vi.mock('../debugger.js', () => ({
  isAttached: vi.fn(() => true),
  getAttachedTabs: vi.fn(() => [10])
}))
vi.mock('./api-client.js', () => ({ getAuthToken: vi.fn(async () => null) }))
vi.mock('./cache-queries.js', () => ({
  handleGetCacheStatus: vi.fn(async () => ({})),
  handleGetCachedData: vi.fn(async () => ({})),
  handleClearCache: vi.fn(async () => ({ success: true })),
  loadCachedDataForUpload: vi.fn()
}))
vi.mock('./collections.js', () => ({
  checkCharacterStatsUpdates: vi.fn(async () => ({})),
  checkCollectionUpdates: vi.fn(async () => ({})),
  checkConflicts: vi.fn(async () => ({})),
  previewSyncDeletions: vi.fn(async () => ({})),
  uploadCharacterStats: vi.fn(async () => ({})),
  uploadCollectionData: vi.fn(async () => ({})),
  uploadDetailData: vi.fn(async () => ({})),
  uploadPartyData: vi.fn(async () => ({}))
}))
vi.mock('./crew.js', () => ({
  handleCreateCrew: vi.fn(async () => ({})),
  handleFetchLatestGwEvent: vi.fn(async () => ({})),
  handlePreviewGwPhantoms: vi.fn(async () => ({})),
  handleUploadUnfScores: vi.fn(async () => ({}))
}))
vi.mock('./reference-data.js', () => ({
  checkExtensionVersion: vi.fn(async () => null),
  createPlaylist: vi.fn(async () => ({})),
  fetchElementVariants: vi.fn(async () => ({})),
  fetchRaidGroups: vi.fn(async () => ({})),
  fetchUserPlaylists: vi.fn(async () => ({})),
  getCollectionIds: vi.fn(async () => ({}))
}))

const PAGES = { 1: { list: ['item'] } }
const sender = {} as chrome.runtime.MessageSender

describe('background message router', () => {
  let handlers: MessageHandlers
  let sendResponse: Mock<(response?: unknown) => void>

  function send(message: ExtensionMessage) {
    return createMessageListener(handlers)(message, sender, sendResponse)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadCachedDataForUpload).mockResolvedValue(PAGES)
    handlers = createHandlers({
      popOutWindow: vi.fn(async () => ({ windowId: 1, alreadyOpen: false }))
    })
    sendResponse = vi.fn()
  })

  it.each<[ExtensionMessage, () => unknown, unknown[]]>([
    [
      { action: 'checkExtensionVersion' },
      () => referenceData.checkExtensionVersion,
      []
    ],
    [{ action: 'getAuth' }, () => apiClient.getAuthToken, []],
    [{ action: 'getCacheStatus' }, () => cacheQueries.handleGetCacheStatus, []],
    [
      { action: 'getCachedData', dataType: 'list_npc' },
      () => cacheQueries.handleGetCachedData,
      ['list_npc']
    ],
    [
      { action: 'clearCache' },
      () => cacheQueries.handleClearCache,
      [undefined]
    ],
    [
      { action: 'fetchRaidGroups', forceRefresh: true },
      () => referenceData.fetchRaidGroups,
      [true]
    ],
    [
      { action: 'fetchElementVariants', forceRefresh: false },
      () => referenceData.fetchElementVariants,
      [false]
    ],
    [
      { action: 'fetchUserPlaylists' },
      () => referenceData.fetchUserPlaylists,
      []
    ],
    [
      { action: 'createPlaylist', data: { title: 'Favorites', visibility: 3 } },
      () => referenceData.createPlaylist,
      [{ title: 'Favorites', visibility: 3 }]
    ],
    [{ action: 'getCollectionIds' }, () => referenceData.getCollectionIds, []],
    [
      {
        action: 'uploadUnfScores',
        dataType: 'unf_scores_77',
        round: 'finals_1'
      },
      () => crew.handleUploadUnfScores,
      ['unf_scores_77', 'finals_1']
    ],
    [
      { action: 'uploadUnfScores', dataType: 'unf_scores_77' },
      () => crew.handleUploadUnfScores,
      ['unf_scores_77', 'preliminaries']
    ],
    [
      { action: 'createCrew', name: 'Skyfarers' },
      () => crew.handleCreateCrew,
      ['Skyfarers']
    ],
    [
      { action: 'previewGwPhantoms', dataType: 'unf_scores_77' },
      () => crew.handlePreviewGwPhantoms,
      ['unf_scores_77']
    ],
    [{ action: 'fetchLatestGwEvent' }, () => crew.handleFetchLatestGwEvent, []]
  ])('routes %o', async (message, target, expectedArguments) => {
    expect(send(message)).toBe(true)
    expect(target()).toHaveBeenCalledWith(...expectedArguments)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
  })

  it.each<[ExtensionMessage, string, () => unknown, unknown[]]>([
    [
      { action: 'uploadDetailData', dataType: 'detail_npc_3040001' },
      'detail_npc_3040001',
      () => collections.uploadDetailData,
      [PAGES, 'detail_npc_3040001']
    ],
    [
      { action: 'checkCollectionUpdates', dataType: 'collection_npc' },
      'collection_npc',
      () => collections.checkCollectionUpdates,
      [PAGES, 'collection_npc']
    ],
    [
      { action: 'checkCharacterStatsUpdates' },
      'character_stats',
      () => collections.checkCharacterStatsUpdates,
      [PAGES]
    ],
    [
      { action: 'previewSyncDeletions', dataType: 'collection_summon' },
      'collection_summon',
      () => collections.previewSyncDeletions,
      [PAGES, 'collection_summon']
    ],
    // Selection is not applied to these two today; the whole capture is sent.
    [
      {
        action: 'checkConflicts',
        dataType: 'collection_weapon',
        selectedIndices: [1]
      },
      'collection_weapon',
      () => collections.checkConflicts,
      [PAGES, 'collection_weapon']
    ],
    [
      { action: 'uploadCharacterStats', selectedIndices: [0] },
      'character_stats',
      () => collections.uploadCharacterStats,
      [PAGES]
    ]
  ])(
    'loads cached data for %o',
    async (message, cacheKey, target, expectedArguments) => {
      expect(send(message)).toBe(true)
      expect(loadCachedDataForUpload).toHaveBeenCalledWith(cacheKey)
      await vi.waitFor(() =>
        expect(target()).toHaveBeenCalledWith(...expectedArguments)
      )
    }
  )

  it('returns no_cached_data without calling the upload', async () => {
    vi.mocked(loadCachedDataForUpload).mockResolvedValue(null)

    send({ action: 'uploadDetailData', dataType: 'detail_npc_3040001' })

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ error: 'no_cached_data' })
    )
    expect(collections.uploadDetailData).not.toHaveBeenCalled()
  })

  it('forwards party import metadata', async () => {
    send({
      action: 'uploadPartyData',
      dataType: 'party_1_2',
      raidId: '42',
      playlistIds: ['7'],
      name: 'Wind',
      visibility: 3,
      shareWithCrew: true
    })

    await vi.waitFor(() =>
      expect(collections.uploadPartyData).toHaveBeenCalledWith(
        PAGES,
        '42',
        ['7'],
        'Wind',
        3,
        true
      )
    )
  })

  // Without updateExisting the API skips owned items, so "Has updates" never applied.
  it('passes collection import and sync options, updating owned items', async () => {
    send({
      action: 'uploadCollectionData',
      dataType: 'collection_weapon',
      selectedIndices: [1],
      conflictResolutions: { a: 'skip' },
      deletionIds: ['old']
    })
    await vi.waitFor(() =>
      expect(collections.uploadCollectionData).toHaveBeenCalledWith(
        PAGES,
        'collection_weapon',
        {
          selectedIndices: [1],
          updateExisting: true,
          conflictResolutions: { a: 'skip' },
          deletionIds: ['old']
        }
      )
    )

    send({
      action: 'syncCollection',
      dataType: 'collection_weapon',
      selectedIndices: [0],
      deletionIds: ['gone']
    })
    await vi.waitFor(() =>
      expect(collections.uploadCollectionData).toHaveBeenLastCalledWith(
        PAGES,
        'collection_weapon',
        {
          selectedIndices: [0],
          updateExisting: true,
          isFullInventory: true,
          reconcileDeletions: true,
          deletionIds: ['gone']
        }
      )
    )
  })

  it('answers synchronous handlers immediately', () => {
    expect(send({ action: 'getDebuggerStatus' })).toBe(false)
    expect(sendResponse).toHaveBeenCalledWith({ attached: true, tabs: [10] })
  })

  it('waits for the pop-out window result', async () => {
    expect(send({ action: 'popOutWindow' })).toBe(true)
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        windowId: 1,
        alreadyOpen: false
      })
    )
  })

  it('ignores unknown actions', () => {
    expect(send({ action: 'notReal' } as unknown as ExtensionMessage)).toBe(
      false
    )
    expect(sendResponse).not.toHaveBeenCalled()
  })

  it('responds with internal_error when a handler rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(referenceData.getCollectionIds).mockRejectedValueOnce(
      new Error('boom')
    )

    send({ action: 'getCollectionIds' })

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ error: 'internal_error' })
    )
  })
})
