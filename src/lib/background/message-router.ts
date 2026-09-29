import { getAttachedTabs, isAttached } from '../debugger.js'
import type {
  ExtensionAction,
  ExtensionMessage,
  MessageOf
} from '../types/messages.js'
import { getAuthToken } from './api-client.js'
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
import type { CharacterStatsEntry, PageData } from './types.js'
import type { WindowManager } from './window-manager.js'

type Handler<A extends ExtensionAction> = (message: MessageOf<A>) => unknown

/** One handler per action. Sync results are sent immediately; promises are awaited. */
export type MessageHandlers = { [A in ExtensionAction]: Handler<A> }

export type BackgroundMessageListener = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean

// Loads the cached capture for `dataType` and hands it to `fn`, or reports
// that there's nothing cached to upload.
async function withCachedData<T, R>(
  dataType: string,
  fn: (data: T) => Promise<R>
): Promise<R | { error: 'no_cached_data' }> {
  const data = await loadCachedDataForUpload(dataType)
  if (!data) return { error: 'no_cached_data' }
  return fn(data as T)
}

type Pages = Record<number, PageData>
type CharacterStats = Record<string, CharacterStatsEntry>

export function createHandlers(
  windowManager: Pick<WindowManager, 'popOutWindow'>
): MessageHandlers {
  return {
    checkExtensionVersion: () => checkExtensionVersion(),
    getAuth: () => getAuthToken(),
    getCacheStatus: () => handleGetCacheStatus(),
    getCachedData: (m) => handleGetCachedData(m.dataType),
    clearCache: (m) => handleClearCache(m.dataType),
    getDebuggerStatus: () => ({
      attached: isAttached(),
      tabs: getAttachedTabs()
    }),
    popOutWindow: () => windowManager.popOutWindow(),

    fetchRaidGroups: (m) => fetchRaidGroups(m.forceRefresh),
    fetchElementVariants: (m) => fetchElementVariants(m.forceRefresh),
    fetchUserPlaylists: () => fetchUserPlaylists(),
    createPlaylist: (m) => createPlaylist(m.data),
    getCollectionIds: () => getCollectionIds(),

    uploadPartyData: (m) =>
      withCachedData(m.dataType, (data) =>
        uploadPartyData(
          data,
          m.raidId,
          m.playlistIds,
          m.name,
          m.visibility,
          m.shareWithCrew
        )
      ),
    uploadDetailData: (m) =>
      withCachedData<Record<string, unknown>, unknown>(m.dataType, (data) =>
        uploadDetailData(data, m.dataType)
      ),

    // checkConflicts and uploadCharacterStats ignore selectedIndices today;
    // the whole cached capture is sent.
    checkConflicts: (m) =>
      withCachedData<Pages, unknown>(m.dataType, (pages) =>
        checkConflicts(pages, m.dataType)
      ),
    checkCollectionUpdates: (m) =>
      withCachedData<Pages, unknown>(m.dataType, (pages) =>
        checkCollectionUpdates(pages, m.dataType)
      ),
    checkCharacterStatsUpdates: () =>
      withCachedData<CharacterStats, unknown>('character_stats', (stats) =>
        checkCharacterStatsUpdates(stats)
      ),
    uploadCollectionData: (m) =>
      withCachedData<Pages, unknown>(m.dataType, (pages) =>
        uploadCollectionData(pages, m.dataType, {
          selectedIndices: m.selectedIndices,
          conflictResolutions: m.conflictResolutions,
          deletionIds: m.deletionIds
        })
      ),
    syncCollection: (m) =>
      withCachedData<Pages, unknown>(m.dataType, (pages) =>
        uploadCollectionData(pages, m.dataType, {
          selectedIndices: m.selectedIndices,
          isFullInventory: true,
          reconcileDeletions: true,
          deletionIds: m.deletionIds
        })
      ),
    previewSyncDeletions: (m) =>
      withCachedData<Pages, unknown>(m.dataType, (pages) =>
        previewSyncDeletions(pages, m.dataType)
      ),
    uploadCharacterStats: () =>
      withCachedData<CharacterStats, unknown>('character_stats', (stats) =>
        uploadCharacterStats(stats)
      ),

    uploadUnfScores: (m) =>
      handleUploadUnfScores(m.dataType, m.round ?? 'preliminaries'),
    createCrew: (m) => handleCreateCrew(m.name ?? ''),
    previewGwPhantoms: (m) => handlePreviewGwPhantoms(m.dataType),
    fetchLatestGwEvent: () => handleFetchLatestGwEvent()
  }
}

export function createMessageListener(
  handlers: MessageHandlers
): BackgroundMessageListener {
  return (message, _sender, sendResponse) => {
    const handler = handlers[message.action] as
      | Handler<ExtensionAction>
      | undefined
    if (!handler) return false

    const result = handler(message as MessageOf<ExtensionAction>)
    if (!(result instanceof Promise)) {
      sendResponse(result)
      return false
    }

    result.then(sendResponse, (error: unknown) => {
      console.error(`Background handler "${message.action}" failed:`, error)
      sendResponse({ error: 'internal_error' })
    })
    // Keep the message channel open until the promise settles.
    return true
  }
}

export function createDefaultMessageListener(
  windowManager: Pick<WindowManager, 'popOutWindow'>
): BackgroundMessageListener {
  return createMessageListener(createHandlers(windowManager))
}
