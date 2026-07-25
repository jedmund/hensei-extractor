import {
  CACHE_KEYS,
  CACHE_PREFIXES,
  CACHE_TTL_MS,
  resolveCacheKey
} from '../constants.js'
import { getAttachedTabs, isAttached } from '../debugger.js'
import type {
  CachedDataResult,
  CachedUnfScores,
  CacheStatusEntry,
  CacheStatusResult,
  UnfMember
} from './types.js'

export async function loadCachedDataForUpload(
  dataType: string
): Promise<Record<string, unknown> | Record<number, unknown> | null> {
  if (dataType === 'character_stats') {
    const result = await chrome.storage.local.get(CACHE_KEYS.character_stats)
    const cached = result[CACHE_KEYS.character_stats!] as
      | { updates?: Record<string, unknown>; lastUpdated?: number }
      | undefined
    if (!cached || Object.keys(cached.updates ?? {}).length === 0) return null
    return cached.updates!
  }

  const cacheKey = resolveCacheKey(dataType)
  if (!cacheKey) return null

  const result = await chrome.storage.local.get(cacheKey)
  const cached = result[cacheKey] as Record<string, unknown> | undefined
  if (!cached) return null

  if (
    dataType.startsWith('list_') ||
    dataType.startsWith('collection_') ||
    dataType.startsWith('stash_')
  ) {
    return (cached.pages as Record<number, unknown>) ?? null
  }

  return (cached.data as Record<string, unknown>) ?? null
}

export async function handleGetCachedData(
  dataType: string
): Promise<CachedDataResult> {
  if (dataType === 'character_stats') {
    const result = await chrome.storage.local.get(CACHE_KEYS.character_stats)
    const cached = result[CACHE_KEYS.character_stats!] as
      | {
          updates?: Record<string, unknown>
          lastUpdated?: number
          characterCount?: number
        }
      | undefined

    if (!cached || Object.keys(cached.updates ?? {}).length === 0) {
      return { error: 'no_character_stats' }
    }

    const age = Date.now() - cached.lastUpdated!
    if (age > CACHE_TTL_MS) {
      return { error: 'stale_data' }
    }

    return {
      data: cached.updates,
      timestamp: cached.lastUpdated,
      age,
      dataType,
      characterCount:
        cached.characterCount ?? Object.keys(cached.updates!).length
    }
  }

  const cacheKey = resolveCacheKey(dataType)
  if (!cacheKey) {
    return { error: 'unknown_type' }
  }

  const result = await chrome.storage.local.get(cacheKey)
  const cached = result[cacheKey] as Record<string, unknown> | undefined

  if (!cached) {
    return { error: 'no_cached_data' }
  }

  const timestamp =
    (cached.timestamp as number) ?? (cached.lastUpdated as number)
  const age = Date.now() - timestamp

  if (age > CACHE_TTL_MS) {
    return { error: 'stale_data' }
  }

  if (
    dataType.startsWith('list_') ||
    dataType.startsWith('collection_') ||
    dataType.startsWith('stash_')
  ) {
    return {
      data: cached.pages as Record<string, unknown>,
      timestamp: cached.lastUpdated as number,
      age,
      dataType,
      pageCount: cached.pageCount as number,
      totalItems: cached.totalItems as number
    }
  }

  if (
    dataType.startsWith('unf_scores_') ||
    dataType.startsWith('unf_daily_scores_')
  ) {
    const unfData = cached as unknown as CachedUnfScores
    const allMembers: UnfMember[] = []
    for (const page of Object.values(unfData.pages)) {
      allMembers.push(...page)
    }
    allMembers.sort((a, b) => a.rank - b.rank)
    return {
      data: {
        eventNumber: unfData.eventNumber,
        members: allMembers,
        totalPages: unfData.totalPages,
        pageCount: unfData.pageCount,
        isComplete: unfData.isComplete
      } as unknown as Record<string, unknown>,
      timestamp: unfData.lastUpdated,
      age,
      dataType,
      totalItems: allMembers.length
    }
  }

  return {
    data: cached.data as Record<string, unknown>,
    timestamp: cached.timestamp as number,
    age,
    dataType
  }
}

export async function handleGetCacheStatus(): Promise<CacheStatusResult> {
  const allStorage = await chrome.storage.local.get(null)
  const status: Record<
    string,
    CacheStatusEntry | { attached: boolean; tabs: number[] }
  > = {}
  const now = Date.now()

  status._debugger = {
    attached: isAttached(),
    tabs: getAttachedTabs()
  }

  for (const [type, key] of Object.entries(CACHE_KEYS)) {
    const cached = allStorage[key] as Record<string, unknown> | undefined
    if (!cached) {
      status[type] = { available: false }
      continue
    }

    const timestamp =
      (cached.timestamp as number) ?? (cached.lastUpdated as number)
    const age = now - timestamp
    const stale = age > CACHE_TTL_MS

    if (type === 'character_stats') {
      const updates = (cached.updates ?? {}) as Record<string, unknown>
      const characterCount = Object.keys(updates).length
      if (characterCount > 0) {
        status[type] = {
          available: !stale,
          lastUpdated: timestamp,
          age,
          isStale: stale,
          characterCount
        }
      }
    } else if (type.startsWith('list_') || type.startsWith('collection_')) {
      status[type] = {
        available: !stale && (cached.pageCount as number) > 0,
        pageCount: (cached.pageCount as number) ?? 0,
        totalPages: (cached.totalPages as number | null) ?? null,
        totalItems: (cached.totalItems as number) ?? 0,
        lastUpdated: timestamp,
        age,
        isStale: stale,
        isComplete: (cached.isComplete as boolean) ?? false
      }
    } else {
      status[type] = {
        available: !stale,
        lastUpdated: timestamp,
        age,
        isStale: stale
      }
    }
  }

  for (const [key, cached] of Object.entries(allStorage)) {
    if (!cached) continue
    const cacheEntry = cached as Record<string, unknown>

    let matchedPrefix: string | null = null
    let suffix: string | null = null
    for (const [prefixName, cachePrefix] of Object.entries(CACHE_PREFIXES)) {
      if (key.startsWith(cachePrefix)) {
        matchedPrefix = prefixName
        suffix = key.slice(cachePrefix.length)
        break
      }
    }
    if (!matchedPrefix || !suffix) continue

    const dataType = `${matchedPrefix}_${suffix}`
    const timestamp =
      (cacheEntry.timestamp as number) ?? (cacheEntry.lastUpdated as number)
    const age = now - timestamp
    const stale = age > CACHE_TTL_MS

    if (matchedPrefix === 'party') {
      status[dataType] = {
        available: !stale,
        lastUpdated: timestamp,
        age,
        isStale: stale,
        partyId: suffix,
        partyName:
          (cacheEntry.partyName as string) ??
          `Party ${suffix.replace('_', '-')}`
      }
    } else if (matchedPrefix.startsWith('stash_')) {
      status[dataType] = {
        available: !stale && (cacheEntry.pageCount as number) > 0,
        pageCount: (cacheEntry.pageCount as number) ?? 0,
        totalItems: (cacheEntry.totalItems as number) ?? 0,
        lastUpdated: timestamp,
        age,
        isStale: stale,
        stashName: (cacheEntry.stashName as string | null) ?? null
      }
    } else if (matchedPrefix.startsWith('detail_')) {
      status[dataType] = {
        available: !stale,
        lastUpdated: timestamp,
        age,
        isStale: stale,
        granblueId: suffix,
        itemName: (cacheEntry.itemName as string) ?? 'Unknown'
      }
    } else if (
      matchedPrefix === 'unf_scores' ||
      matchedPrefix === 'unf_daily_scores'
    ) {
      const unfData = cacheEntry as unknown as CachedUnfScores
      status[dataType] = {
        available: !stale && unfData.memberCount > 0,
        lastUpdated: timestamp,
        age,
        isStale: stale,
        pageCount: unfData.pageCount,
        totalPages: unfData.totalPages,
        totalItems: unfData.memberCount,
        isComplete: unfData.isComplete
      }
    }
  }

  return status as CacheStatusResult
}

export async function handleClearCache(
  dataType?: string
): Promise<{ success: boolean }> {
  if (dataType) {
    const cacheKey = resolveCacheKey(dataType)
    if (cacheKey) {
      await chrome.storage.local.remove(cacheKey)
    }
  } else {
    const allStorage = await chrome.storage.local.get(null)
    const prefixValues = Object.values(CACHE_PREFIXES)
    const keysToRemove = [
      ...Object.values(CACHE_KEYS),
      ...Object.keys(allStorage).filter((key) =>
        prefixValues.some((prefix) => key.startsWith(prefix))
      )
    ]
    await chrome.storage.local.remove(keysToRemove)
  }
  return { success: true }
}
