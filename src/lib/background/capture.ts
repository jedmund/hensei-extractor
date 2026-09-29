import { CACHE_PREFIXES } from '../constants.js'
import type { InterceptMetadata } from '../debugger.js'
import {
  cacheDetailItem,
  cacheGuildInfo,
  cacheListPage,
  cacheParty,
  cacheSingleItem,
  cacheUnfScores
} from './cache-writes.js'
import { cacheCharacterStats } from './character-stats.js'
import type { PageData } from './types.js'

export interface CaptureDependencies {
  cacheParty: typeof cacheParty
  cacheCharacterStats: typeof cacheCharacterStats
  cacheListPage: typeof cacheListPage
  cacheDetailItem: typeof cacheDetailItem
  cacheUnfScores: typeof cacheUnfScores
  cacheGuildInfo: typeof cacheGuildInfo
  cacheSingleItem: typeof cacheSingleItem
  notifyCaptured: (message: Record<string, unknown>) => Promise<unknown>
}

export function createCaptureHandler(dependencies: CaptureDependencies) {
  return async function handleInterceptedData(
    url: string,
    data: unknown,
    dataType: string,
    metadata: InterceptMetadata,
    timestamp: number
  ): Promise<void> {
    if (!data || !dataType || dataType === 'unknown') {
      return
    }

    const { pageNumber, partyId, masterId, eventNumber } = metadata

    try {
      let actualDataType = dataType
      let cached = false

      if (dataType === 'party' && partyId) {
        cached = await dependencies.cacheParty(
          partyId,
          data as Record<string, unknown>,
          timestamp,
          url
        )
        actualDataType = `party_${partyId}`
      } else if (dataType === 'character_detail' || dataType === 'zenith_npc') {
        cached = await dependencies.cacheCharacterStats(
          dataType,
          data as Record<string, unknown>,
          masterId,
          timestamp,
          url
        )
        actualDataType = 'character_stats'
      } else if (dataType.startsWith('stash_')) {
        const stashNum = metadata.stashNumber ?? '1'
        const prefix = CACHE_PREFIXES[dataType]
        cached = await dependencies.cacheListPage(
          dataType,
          pageNumber,
          data as PageData,
          timestamp,
          prefix ? prefix + stashNum : undefined,
          metadata.stashName ?? undefined
        )
        actualDataType = `${dataType}_${stashNum}`
      } else if (
        dataType.startsWith('list_') ||
        dataType.startsWith('collection_')
      ) {
        cached = await dependencies.cacheListPage(
          dataType,
          pageNumber,
          data as PageData,
          timestamp
        )
      } else if (dataType.startsWith('detail_')) {
        const result = await dependencies.cacheDetailItem(
          dataType,
          data as Record<string, unknown>,
          timestamp,
          url
        )
        actualDataType = result.dataType
        cached = result.cached
        if (dataType === 'detail_npc') {
          const detail = data as Record<string, unknown>
          await dependencies.cacheCharacterStats(
            'character_detail',
            detail,
            ((detail.master as Record<string, unknown>)?.id as string) ?? null,
            timestamp,
            url
          )
        }
      } else if (
        (dataType === 'unf_scores' || dataType === 'unf_daily_scores') &&
        eventNumber
      ) {
        cached = await dependencies.cacheUnfScores(
          eventNumber,
          pageNumber,
          data,
          timestamp,
          dataType
        )
        actualDataType = `${dataType}_${eventNumber}`
      } else if (dataType === 'guild_info') {
        cached = await dependencies.cacheGuildInfo(data, timestamp)
        actualDataType = 'guild_info'
      } else {
        cached = await dependencies.cacheSingleItem(
          dataType,
          data,
          timestamp,
          url
        )
      }

      if (cached) {
        dependencies
          .notifyCaptured({
            action: 'dataCaptured',
            dataType: actualDataType,
            pageNumber,
            timestamp
          })
          .catch(() => {})
      }
    } catch (error) {
      console.error('[Background] Error caching data:', error)
    }
  }
}

export function createDefaultCaptureHandler() {
  return createCaptureHandler({
    cacheParty,
    cacheCharacterStats,
    cacheListPage,
    cacheDetailItem,
    cacheUnfScores,
    cacheGuildInfo,
    cacheSingleItem,
    notifyCaptured: (message) => chrome.runtime.sendMessage(message)
  })
}
