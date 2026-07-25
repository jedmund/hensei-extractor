import { CACHE_KEYS, CACHE_PREFIXES, CACHE_TTL_MS } from '../constants.js'
import type {
  CachedGuildInfo,
  CachedListData,
  CachedUnfScores,
  PageData,
  UnfMember
} from './types.js'

export async function cacheSingleItem(
  dataType: string,
  data: unknown,
  timestamp: number,
  url: string
): Promise<boolean> {
  const cacheKey = CACHE_KEYS[dataType]
  if (!cacheKey) return false

  await chrome.storage.local.set({
    [cacheKey]: { data, timestamp, url }
  })
  return true
}

export async function cacheDetailItem(
  dataType: string,
  data: Record<string, unknown>,
  timestamp: number,
  url: string
): Promise<{ dataType: string; cached: boolean }> {
  const master = data.master as Record<string, unknown> | undefined
  const granblueId = (data.id as string) ?? master?.id
  const name = (data.name as string) ?? master?.name ?? 'Unknown'

  const prefix = CACHE_PREFIXES[dataType]
  if (!prefix) {
    const cached = await cacheSingleItem(dataType, data, timestamp, url)
    return { dataType, cached }
  }
  const cacheKey = `${prefix}${granblueId}`

  await chrome.storage.local.set({
    [cacheKey]: {
      data,
      timestamp,
      url,
      granblueId,
      itemName: name
    }
  })

  return { dataType: `${dataType}_${granblueId}`, cached: true }
}

export async function cacheParty(
  partyId: string,
  data: Record<string, unknown>,
  timestamp: number,
  url: string
): Promise<boolean> {
  const cacheKey = CACHE_PREFIXES.party + partyId
  const deck = data.deck as Record<string, unknown> | undefined
  const partyName =
    (deck?.name as string) ?? `Party ${partyId.replace('_', '-')}`

  await chrome.storage.local.set({
    [cacheKey]: { data, timestamp, url, partyId, partyName }
  })
  return true
}

export async function cacheListPage(
  dataType: string,
  pageNumber: number | null,
  data: PageData,
  timestamp: number,
  cacheKeyOverride?: string,
  stashName?: string
): Promise<boolean> {
  const cacheKey = cacheKeyOverride ?? CACHE_KEYS[dataType]
  if (!cacheKey) return false

  const result = await chrome.storage.local.get(cacheKey)
  const existing: CachedListData = (result[cacheKey] as CachedListData) ?? {
    pages: {},
    lastUpdated: null
  }

  if (stashName) {
    existing.stashName = stashName
  }

  if (existing.lastUpdated && timestamp - existing.lastUpdated > CACHE_TTL_MS) {
    existing.pages = {}
  }

  if (pageNumber != null) {
    existing.pages[pageNumber] = data
  }
  existing.lastUpdated = timestamp

  if (data.option?.total_page) {
    existing.totalPages = data.option.total_page
  }

  let totalItems = 0
  for (const page of Object.values(existing.pages)) {
    if ((page as PageData).list && Array.isArray((page as PageData).list)) {
      totalItems += (page as PageData).list!.length
    }
  }
  existing.totalItems = totalItems
  existing.pageCount = Object.keys(existing.pages).length

  existing.isComplete = existing.totalPages
    ? existing.pageCount >= existing.totalPages
    : false

  await chrome.storage.local.set({ [cacheKey]: existing })
  return true
}

export async function cacheUnfScores(
  eventNumber: number,
  pageNumber: number | null,
  data: unknown,
  timestamp: number,
  dataTypePrefix: string
): Promise<boolean> {
  const prefix = CACHE_PREFIXES[dataTypePrefix]
  if (!prefix) return false
  const cacheKey = prefix + eventNumber

  const memberList = (
    data as { member_list?: { list?: unknown; last?: number } }
  )?.member_list
  if (!memberList?.list) return false

  const rawList: unknown[] = Array.isArray(memberList.list)
    ? memberList.list
    : Object.values(memberList.list as Record<string, unknown>)

  if (rawList.length === 0) return false

  const result = await chrome.storage.local.get(cacheKey)
  const existing: CachedUnfScores = (result[cacheKey] as CachedUnfScores) ?? {
    eventNumber,
    pages: {},
    lastUpdated: 0,
    totalPages: 1,
    pageCount: 0,
    memberCount: 0,
    isComplete: false
  }

  if (existing.lastUpdated && timestamp - existing.lastUpdated > CACHE_TTL_MS) {
    existing.pages = {}
  }

  const members: UnfMember[] = rawList.map((m: unknown) => {
    const member = m as Record<string, unknown>
    return {
      id: member.id as string,
      name: member.name as string,
      contribution: member.contribution as number,
      rank: member.rank as number,
      level: member.level as string
    }
  })

  if (pageNumber != null) {
    existing.pages[pageNumber] = members
  }

  existing.lastUpdated = timestamp
  existing.totalPages = (memberList.last as number) ?? existing.totalPages

  let memberCount = 0
  for (const page of Object.values(existing.pages)) {
    memberCount += page.length
  }
  existing.memberCount = memberCount
  existing.pageCount = Object.keys(existing.pages).length
  existing.isComplete = existing.pageCount >= existing.totalPages

  await chrome.storage.local.set({ [cacheKey]: existing })
  return true
}

export async function cacheGuildInfo(
  data: unknown,
  timestamp: number
): Promise<boolean> {
  const guildData = data as { is_guild_in?: string }
  if (!guildData?.is_guild_in) return false

  const cacheKey = CACHE_KEYS.guild_info!
  await chrome.storage.local.set({
    [cacheKey]: {
      guildId: guildData.is_guild_in,
      timestamp
    } satisfies CachedGuildInfo
  })
  return true
}
