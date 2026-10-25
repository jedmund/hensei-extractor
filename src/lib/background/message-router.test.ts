import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ExtensionMessage } from '../types/messages.js'
import { loadCachedDataForUpload } from './cache-queries.js'
import * as collections from './collections.js'
import * as crew from './crew.js'
import * as referenceData from './reference-data.js'
import * as partyReference from './party-reference.js'
import * as apiClient from './api-client.js'
import * as cacheQueries from './cache-queries.js'
import { withImportMark } from './import-marks.js'
import * as databaseQueue from './database-queue.js'
import {
  uploadSolomonisParty,
  uploadSolomonisRun
} from '../solomonis/upload.js'
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
vi.mock('./import-marks.js', () => ({
  withImportMark: vi.fn((_dataType: string, upload: () => Promise<unknown>) =>
    upload()
  )
}))
vi.mock('./database-queue.js', () => ({
  clearImportQueue: vi.fn(async () => ({ success: true })),
  getImportQueue: vi.fn(async () => ({})),
  importQueueAll: vi.fn(async () => ({})),
  importQueuedItem: vi.fn(async () => ({ success: true }))
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
vi.mock('../solomonis/upload.js', () => ({
  uploadSolomonisRun: vi.fn(async () => ({})),
  uploadSolomonisParty: vi.fn(async () => ({}))
}))
vi.mock('./party-reference.js', () => ({
  fetchJobSkillSlugs: vi.fn(async () => ({})),
  fetchWeaponKeyMap: vi.fn(async () => null),
  fetchWeaponStatModifiers: vi.fn(async () => null),
  searchSummonByName: vi.fn(async () => null)
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
      { action: 'searchSummonByName', name: 'Bahamut' },
      () => partyReference.searchSummonByName,
      ['Bahamut']
    ],
    [
      { action: 'fetchWeaponKeyMap', locale: 'ja' },
      () => partyReference.fetchWeaponKeyMap,
      ['ja']
    ],
    [
      { action: 'fetchWeaponStatModifiers' },
      () => partyReference.fetchWeaponStatModifiers,
      []
    ],
    [
      { action: 'fetchJobSkillSlugs', names: ['Rage IV'] },
      () => partyReference.fetchJobSkillSlugs,
      [['Rage IV']]
    ],
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

  it.each<[ExtensionMessage, string]>([
    [{ action: 'uploadPartyData', dataType: 'party_1_2' }, 'party_1_2'],
    [
      { action: 'uploadCollectionData', dataType: 'collection_npc' },
      'collection_npc'
    ],
    [{ action: 'syncCollection', dataType: 'list_weapon' }, 'list_weapon'],
    [{ action: 'uploadCharacterStats' }, 'character_stats'],
    [{ action: 'uploadSupportSummons' }, 'support_summons'],
    [
      { action: 'uploadSolomonisRun', dataType: 'solomonis_run_381099' },
      'solomonis_run_381099'
    ],
    [
      { action: 'uploadSolomonisParty', dataType: 'solomonis_deck_31001' },
      'solomonis_deck_31001'
    ],
    [{ action: 'uploadUnfScores', dataType: 'unf_scores_77' }, 'unf_scores_77']
  ])('marks the capture imported after %o', async (message, dataType) => {
    send(message)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
    expect(withImportMark).toHaveBeenCalledTimes(1)
    expect(withImportMark).toHaveBeenCalledWith(dataType, expect.any(Function))
  })

  it.each<ExtensionMessage>([
    { action: 'checkConflicts', dataType: 'collection_weapon' },
    { action: 'checkCollectionUpdates', dataType: 'collection_npc' },
    { action: 'previewSyncDeletions', dataType: 'collection_summon' },
    { action: 'previewGwPhantoms', dataType: 'unf_scores_77' }
  ])('does not mark anything for %o', async (message) => {
    send(message)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
    expect(withImportMark).not.toHaveBeenCalled()
  })

  it('returns no_cached_data without calling the upload', async () => {
    vi.mocked(loadCachedDataForUpload).mockResolvedValue(null)

    send({ action: 'uploadCollectionData', dataType: 'collection_npc' })

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ error: 'no_cached_data' })
    )
    expect(collections.uploadCollectionData).not.toHaveBeenCalled()
  })

  it('imports a queued journal page by its queue key', async () => {
    send({ action: 'uploadDetailData', dataType: 'detail_npc_3040001_2_jp' })

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ success: true })
    )
    expect(databaseQueue.importQueuedItem).toHaveBeenCalledWith(
      'npc_3040001_2_jp'
    )
    expect(withImportMark).not.toHaveBeenCalled()
  })

  it('answers no_cached_data for a detail page outside the queue', async () => {
    send({ action: 'uploadDetailData', dataType: 'detail_npc_3040001' })

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ error: 'no_cached_data' })
    )
    expect(databaseQueue.importQueuedItem).not.toHaveBeenCalled()
  })

  it.each<[ExtensionMessage, () => unknown]>([
    [{ action: 'getImportQueue' }, () => databaseQueue.getImportQueue],
    [{ action: 'importQueueAll' }, () => databaseQueue.importQueueAll],
    [{ action: 'clearImportQueue' }, () => databaseQueue.clearImportQueue]
  ])('routes %o to the import queue', async (message, target) => {
    send(message)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
    expect(target()).toHaveBeenCalled()
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

  it('forwards Solomonis run import options with the cached report', async () => {
    send({
      action: 'uploadSolomonisRun',
      dataType: 'solomonis_run_381099',
      name: 'Nier',
      visibility: 1,
      playlistIds: ['7'],
      shareWithCrew: false,
      updateExisting: true
    })

    await vi.waitFor(() =>
      expect(uploadSolomonisRun).toHaveBeenCalledWith(PAGES, {
        name: 'Nier',
        visibility: 1,
        playlistIds: ['7'],
        shareWithCrew: false,
        updateExisting: true,
        currentSetup: null
      })
    )
    expect(loadCachedDataForUpload).toHaveBeenCalledWith('solomonis_run_381099')
  })

  it('sends the picked deck for the report Evoker as current_setup, without the uid', async () => {
    const report = {
      reportId: '381099',
      report: { thumbnail_image: '3040161000_04' },
      statusList: []
    }
    const deck = {
      deck: {
        priority: 31001,
        npc: { '1': { master: { id: '3040161000' } } },
        pc: { param: { id: 12345678, hp: 1 } }
      }
    }
    vi.mocked(loadCachedDataForUpload).mockImplementation(async (type) =>
      type === 'solomonis_deck_31001' ? deck : report
    )

    send({
      action: 'uploadSolomonisRun',
      dataType: 'solomonis_run_381099',
      currentSetupDataType: 'solomonis_deck_31001'
    })

    await vi.waitFor(() => expect(uploadSolomonisRun).toHaveBeenCalled())
    const options = vi.mocked(uploadSolomonisRun).mock.calls[0]![1]!
    expect(options.currentSetup?.deck.priority).toBe(31001)
    expect(options.currentSetup?.deck.pc).toEqual({ param: { hp: 1 } })
  })

  it("drops a picked deck for another Evoker, or that isn't a deck", async () => {
    const report = {
      reportId: '381099',
      report: { thumbnail_image: '3040169000_04' },
      statusList: []
    }
    const deck = {
      deck: { priority: 31001, npc: { '1': { master: { id: '3040161000' } } } }
    }
    vi.mocked(loadCachedDataForUpload).mockImplementation(async (type) =>
      type === 'solomonis_deck_31001' ? deck : report
    )

    send({
      action: 'uploadSolomonisRun',
      dataType: 'solomonis_run_381099',
      currentSetupDataType: 'solomonis_deck_31001'
    })
    await vi.waitFor(() => expect(uploadSolomonisRun).toHaveBeenCalledTimes(1))
    expect(
      vi.mocked(uploadSolomonisRun).mock.calls[0]![1]!.currentSetup
    ).toBeNull()

    send({
      action: 'uploadSolomonisRun',
      dataType: 'solomonis_run_381099',
      currentSetupDataType: 'party_1_1'
    })
    await vi.waitFor(() => expect(uploadSolomonisRun).toHaveBeenCalledTimes(2))
    expect(
      vi.mocked(uploadSolomonisRun).mock.calls[1]![1]!.currentSetup
    ).toBeNull()
    expect(loadCachedDataForUpload).not.toHaveBeenCalledWith('party_1_1')
  })

  it('imports a captured Solomonis deck with the party meta', async () => {
    send({
      action: 'uploadSolomonisParty',
      dataType: 'solomonis_deck_31001',
      name: 'Fraux',
      visibility: 2,
      playlistIds: ['7'],
      shareWithCrew: true
    })

    await vi.waitFor(() =>
      expect(uploadSolomonisParty).toHaveBeenCalledWith(PAGES, {
        name: 'Fraux',
        visibility: 2,
        playlistIds: ['7'],
        shareWithCrew: true
      })
    )
    expect(loadCachedDataForUpload).toHaveBeenCalledWith('solomonis_deck_31001')
  })

  it('only imports Solomonis parties from Solomonis deck captures', async () => {
    send({ action: 'uploadSolomonisParty', dataType: 'party_1_2' })

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ error: 'unknown_type' })
    )
    expect(uploadSolomonisParty).not.toHaveBeenCalled()
  })

  it('only uploads Solomonis runs from Solomonis run captures', async () => {
    send({ action: 'uploadSolomonisRun', dataType: 'party_1_2' })

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ error: 'unknown_type' })
    )
    expect(loadCachedDataForUpload).not.toHaveBeenCalled()
    expect(uploadSolomonisRun).not.toHaveBeenCalled()
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
