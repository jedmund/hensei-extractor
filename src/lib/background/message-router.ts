import { getAttachedTabs, isAttached } from '../debugger.js'
import {
  handleClearCache,
  handleGetCachedData,
  handleGetCacheStatus,
  loadCachedDataForUpload
} from './cache-queries.js'
import {
  checkCharacterStatsUpdates,
  checkCollectionUpdates,
  checkConflicts,
  previewSyncDeletions,
  uploadCharacterStats,
  uploadCollectionData,
  uploadDetailData,
  uploadPartyData
} from './collections.js'
import {
  handleCreateCrew,
  handleFetchLatestGwEvent,
  handlePreviewGwPhantoms,
  handleUploadUnfScores
} from './crew.js'
import {
  checkExtensionVersion,
  createPlaylist,
  fetchElementVariants,
  fetchRaidGroups,
  fetchUserPlaylists,
  getCollectionIds
} from './reference-data.js'
import type {
  BackgroundMessage,
  CharacterStatsEntry,
  PageData
} from './types.js'
import type { WindowManager } from './window-manager.js'

export interface MessageRouterDependencies {
  checkExtensionVersion: typeof checkExtensionVersion
  handleGetCacheStatus: typeof handleGetCacheStatus
  handleGetCachedData: typeof handleGetCachedData
  handleClearCache: typeof handleClearCache
  isAttached: typeof isAttached
  getAttachedTabs: typeof getAttachedTabs
  handlePopOutWindow: WindowManager['handlePopOutWindow']
  fetchRaidGroups: typeof fetchRaidGroups
  fetchElementVariants: typeof fetchElementVariants
  fetchUserPlaylists: typeof fetchUserPlaylists
  createPlaylist: typeof createPlaylist
  loadCachedDataForUpload: typeof loadCachedDataForUpload
  uploadPartyData: typeof uploadPartyData
  uploadDetailData: typeof uploadDetailData
  getCollectionIds: typeof getCollectionIds
  checkConflicts: typeof checkConflicts
  checkCollectionUpdates: typeof checkCollectionUpdates
  checkCharacterStatsUpdates: typeof checkCharacterStatsUpdates
  uploadCollectionData: typeof uploadCollectionData
  previewSyncDeletions: typeof previewSyncDeletions
  uploadCharacterStats: typeof uploadCharacterStats
  handleUploadUnfScores: typeof handleUploadUnfScores
  handleCreateCrew: typeof handleCreateCrew
  handlePreviewGwPhantoms: typeof handlePreviewGwPhantoms
  handleFetchLatestGwEvent: typeof handleFetchLatestGwEvent
}

export type BackgroundMessageListener = (
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean

export function createMessageListener(
  dependencies: MessageRouterDependencies
): BackgroundMessageListener {
  return (message, _sender, sendResponse) => {
    switch (message.action) {
      case 'checkExtensionVersion':
        dependencies.checkExtensionVersion().then(sendResponse)
        return true

      case 'getCacheStatus':
        dependencies.handleGetCacheStatus().then(sendResponse)
        return true

      case 'getCachedData':
        dependencies.handleGetCachedData(message.dataType!).then(sendResponse)
        return true

      case 'clearCache':
        dependencies.handleClearCache(message.dataType).then(sendResponse)
        return true

      case 'getDebuggerStatus':
        sendResponse({
          attached: dependencies.isAttached(),
          tabs: dependencies.getAttachedTabs()
        })
        return false

      case 'popOutWindow':
        return dependencies.handlePopOutWindow(sendResponse)

      case 'fetchRaidGroups':
        dependencies.fetchRaidGroups(message.forceRefresh).then(sendResponse)
        return true

      case 'fetchElementVariants':
        dependencies
          .fetchElementVariants(message.forceRefresh)
          .then(sendResponse)
        return true

      case 'fetchUserPlaylists':
        dependencies.fetchUserPlaylists().then(sendResponse)
        return true

      case 'createPlaylist':
        dependencies
          .createPlaylist(
            message.data as {
              title: string
              description: string
              visibility: number
            }
          )
          .then(sendResponse)
        return true

      case 'uploadPartyData':
        dependencies.loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .uploadPartyData(
              data,
              message.raidId,
              message.playlistIds,
              message.name,
              message.visibility,
              message.shareWithCrew
            )
            .then(sendResponse)
        })
        return true

      case 'uploadDetailData':
        dependencies.loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .uploadDetailData(
              data as Record<string, unknown>,
              message.dataType!
            )
            .then(sendResponse)
        })
        return true

      case 'getCollectionIds':
        dependencies.getCollectionIds().then(sendResponse)
        return true

      case 'checkConflicts':
        dependencies.loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .checkConflicts(data as Record<number, PageData>, message.dataType!)
            .then(sendResponse)
        })
        return true

      case 'checkCollectionUpdates':
        dependencies.loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .checkCollectionUpdates(
              data as Record<number, PageData>,
              message.dataType!
            )
            .then(sendResponse)
        })
        return true

      case 'checkCharacterStatsUpdates':
        dependencies.loadCachedDataForUpload('character_stats').then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .checkCharacterStatsUpdates(
              data as Record<string, CharacterStatsEntry>
            )
            .then(sendResponse)
        })
        return true

      case 'uploadCollectionData':
        dependencies.loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .uploadCollectionData(
              data as Record<number, PageData>,
              message.dataType!,
              {
                selectedIndices: message.selectedIndices,
                conflictResolutions: message.conflictResolutions,
                deletionIds: message.deletionIds
              }
            )
            .then(sendResponse)
        })
        return true

      case 'syncCollection':
        dependencies.loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .uploadCollectionData(
              data as Record<number, PageData>,
              message.dataType!,
              {
                selectedIndices: message.selectedIndices,
                isFullInventory: true,
                reconcileDeletions: true,
                deletionIds: message.deletionIds
              }
            )
            .then(sendResponse)
        })
        return true

      case 'previewSyncDeletions':
        dependencies.loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .previewSyncDeletions(
              data as Record<number, PageData>,
              message.dataType!
            )
            .then(sendResponse)
        })
        return true

      case 'uploadCharacterStats':
        dependencies.loadCachedDataForUpload('character_stats').then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          dependencies
            .uploadCharacterStats(data as Record<string, CharacterStatsEntry>)
            .then(sendResponse)
        })
        return true

      case 'uploadUnfScores':
        dependencies
          .handleUploadUnfScores(
            message.dataType!,
            (message as { round?: string }).round ?? 'preliminaries'
          )
          .then(sendResponse)
        return true

      case 'createCrew':
        dependencies
          .handleCreateCrew((message as { name?: string }).name ?? '')
          .then(sendResponse)
        return true

      case 'previewGwPhantoms':
        dependencies
          .handlePreviewGwPhantoms((message as { dataType: string }).dataType)
          .then(sendResponse)
        return true

      case 'fetchLatestGwEvent':
        dependencies.handleFetchLatestGwEvent().then(sendResponse)
        return true

      default:
        return false
    }
  }
}

export function createDefaultMessageListener(
  handlePopOutWindow: WindowManager['handlePopOutWindow']
): BackgroundMessageListener {
  return createMessageListener({
    checkExtensionVersion,
    handleGetCacheStatus,
    handleGetCachedData,
    handleClearCache,
    isAttached,
    getAttachedTabs,
    handlePopOutWindow,
    fetchRaidGroups,
    fetchElementVariants,
    fetchUserPlaylists,
    createPlaylist,
    loadCachedDataForUpload,
    uploadPartyData,
    uploadDetailData,
    getCollectionIds,
    checkConflicts,
    checkCollectionUpdates,
    checkCharacterStatsUpdates,
    uploadCollectionData,
    previewSyncDeletions,
    uploadCharacterStats,
    handleUploadUnfScores,
    handleCreateCrew,
    handlePreviewGwPhantoms,
    handleFetchLatestGwEvent
  })
}
