/**
 * Background service worker for the Granblue Fantasy Chrome extension.
 * Uses Chrome DevTools Debugger Protocol for network interception - completely
 * invisible to the page with no modified globals or injected scripts.
 *
 * IMPORTANT: This extension uses passive interception - it never makes
 * requests to GBF servers. All game data comes from intercepted responses.
 */

import {
  getApiUrl,
  getSiteBaseUrl,
  CACHE_KEYS,
  CACHE_PREFIXES,
  CACHE_TTL_MS,
  RAID_GROUPS_CACHE_TTL_MS,
  resolveCacheKey
} from './constants.js'
import {
  initDebugger,
  isAttached,
  getAttachedTabs,
  type InterceptMetadata
} from './debugger.js'
import {
  OVER_MASTERY_TYPE_ID,
  lookupAetherialTypeId,
  PERPETUITY_TYPE_ID,
  parseDisplayValue
} from './mastery.js'

// ==========================================
// TYPES
// ==========================================

interface AuthToken {
  access_token: string
  user: { id: string; username: string }
  expires_at?: number
  language?: string
}

interface CachedListData {
  pages: Record<number, PageData>
  lastUpdated: number | null
  stashName?: string
  totalPages?: number
  totalItems?: number
  pageCount?: number
  isComplete?: boolean
}

interface PageData {
  list?: unknown[]
  option?: { total_page?: number; filter?: Record<string, string> }
  options?: { filter?: Record<string, string> }
  current?: number
}

interface CharacterStatsEntry {
  masterId: string
  masterName?: string
  timestamp?: number
  element?: string | number
  uncapLevel?: number
  transcendenceStep?: number
  awakening?: {
    type: unknown
    typeName?: string
    level: number
  }
  perpetuity?: boolean
  rings?: MasteryMod[]
  earring?: MasteryMod | null
  perpetuityBonuses?: MasteryMod[]
  rawData?: Record<string, unknown>
}

interface MasteryMod {
  modifier: number
  strength: number
  typeName?: string
  slot?: number
}

interface ParsedMasteryData {
  rings: MasteryMod[]
  earring: MasteryMod | null
  masterName: string | null
  perpetuityBonuses: MasteryMod[]
}

interface GameFilter {
  elements: number[] | null
  proficiencies: number[] | null
}

interface UploadCollectionOptions {
  updateExisting?: boolean
  isFullInventory?: boolean
  reconcileDeletions?: boolean
  conflictResolutions?: unknown
  selectedIndices?: number[]
  deletionIds?: string[]
}

// --- API response types ---

interface ApiResult<T = Record<string, unknown>> {
  error?: string
  data?: T
  auth?: AuthToken
}

interface UploadPartyResult {
  success?: boolean
  shortcode?: string
  url?: string
  error?: string
}

interface UploadDetailResult {
  success?: boolean
  error?: string
  [key: string]: unknown
}

interface UploadCollectionResult {
  success?: boolean
  created?: number
  updated?: number
  skipped?: number
  errors?: unknown[]
  reconciliation?: unknown
  error?: string
}

interface ConflictCheckResult {
  conflicts?: unknown[]
  error?: string
}

interface SyncPreviewResult {
  willDelete?: unknown[]
  count?: number
  error?: string
}

interface CachedDataResult {
  data?: Record<string, unknown> | Record<number, unknown>
  error?: string
  timestamp?: number
  age?: number
  dataType?: string
  pageCount?: number
  totalItems?: number
  characterCount?: number
}

interface CacheStatusEntry {
  available: boolean
  lastUpdated?: number
  age?: number
  isStale?: boolean
  pageCount?: number
  totalPages?: number | null
  totalItems?: number
  isComplete?: boolean
  characterCount?: number
  partyId?: string
  partyName?: string
  stashName?: string | null
  granblueId?: string
  itemName?: string
}

interface CacheStatusResult {
  _debugger: { attached: boolean; tabs: number[] }
  [key: string]: CacheStatusEntry | { attached: boolean; tabs: number[] }
}

interface FetchPlaylistsResult {
  data?: unknown
  error?: string
}

interface FetchRaidGroupsResult {
  data?: unknown
  error?: string
}

interface CreatePlaylistResult {
  data?: Record<string, unknown>
  error?: string
}

interface VersionCheckResult {
  isOutdated: boolean
  current: string
  latest: string
}

interface CachedUnfScores {
  eventNumber: number
  pages: Record<number, UnfMember[]>
  lastUpdated: number
  totalPages: number
  pageCount: number
  memberCount: number
  isComplete: boolean
}

interface UnfMember {
  id: string
  name: string
  contribution: number
  rank: number
  level: string
}

interface CachedGuildInfo {
  guildId: string
  timestamp: number
}

// ==========================================
// INITIALIZATION
// ==========================================

initDebugger(handleInterceptedData)

let collectionIdsCache: {
  weapons?: string[]
  summons?: string[]
  characters?: string[]
  artifacts?: string[]
} | null = null
let collectionIdsCacheTime = 0
const COLLECTION_IDS_TTL_MS = 5 * 60 * 1000

let popOutWindowId: number | null = null

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId })
  }
})

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popOutWindowId) {
    popOutWindowId = null
  }
})

// ==========================================
// DATA INTERCEPTION HANDLER
// ==========================================

async function handleInterceptedData(
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

    if (dataType === 'party' && partyId) {
      await cacheParty(partyId, data as Record<string, unknown>, timestamp, url)
      actualDataType = `party_${partyId}`
    } else if (dataType === 'character_detail' || dataType === 'zenith_npc') {
      await cacheCharacterStats(
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
      await cacheListPage(
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
      await cacheListPage(dataType, pageNumber, data as PageData, timestamp)
    } else if (dataType.startsWith('detail_')) {
      const result = await cacheDetailItem(
        dataType,
        data as Record<string, unknown>,
        timestamp,
        url
      )
      actualDataType = result.dataType
      if (dataType === 'detail_npc') {
        const d = data as Record<string, unknown>
        await cacheCharacterStats(
          'character_detail',
          d,
          ((d.master as Record<string, unknown>)?.id as string) ?? null,
          timestamp,
          url
        )
      }
    } else if (
      (dataType === 'unf_scores' || dataType === 'unf_daily_scores') &&
      eventNumber
    ) {
      await cacheUnfScores(eventNumber, pageNumber, data, timestamp, dataType)
      actualDataType = `${dataType}_${eventNumber}`
    } else if (dataType === 'guild_info') {
      await cacheGuildInfo(data, timestamp)
      actualDataType = 'guild_info'
    } else {
      await cacheSingleItem(dataType, data, timestamp, url)
    }

    chrome.runtime
      .sendMessage({
        action: 'dataCaptured',
        dataType: actualDataType,
        pageNumber,
        timestamp
      })
      .catch(() => {})
  } catch (error) {
    console.error('[Background] Error caching data:', error)
  }
}

// ==========================================
// CACHING FUNCTIONS
// ==========================================

async function cacheSingleItem(
  dataType: string,
  data: unknown,
  timestamp: number,
  url: string
): Promise<void> {
  const cacheKey = CACHE_KEYS[dataType]
  if (!cacheKey) return

  await chrome.storage.local.set({
    [cacheKey]: { data, timestamp, url }
  })
}

async function cacheDetailItem(
  dataType: string,
  data: Record<string, unknown>,
  timestamp: number,
  url: string
): Promise<{ dataType: string }> {
  const master = data.master as Record<string, unknown> | undefined
  const granblueId = (data.id as string) ?? master?.id
  const name = (data.name as string) ?? master?.name ?? 'Unknown'

  const prefix = CACHE_PREFIXES[dataType]
  if (!prefix) {
    await cacheSingleItem(dataType, data, timestamp, url)
    return { dataType }
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

  return { dataType: `${dataType}_${granblueId}` }
}

async function cacheParty(
  partyId: string,
  data: Record<string, unknown>,
  timestamp: number,
  url: string
): Promise<void> {
  const cacheKey = CACHE_PREFIXES.party + partyId
  const deck = data.deck as Record<string, unknown> | undefined
  const partyName =
    (deck?.name as string) ?? `Party ${partyId.replace('_', '-')}`

  await chrome.storage.local.set({
    [cacheKey]: { data, timestamp, url, partyId, partyName }
  })
}

async function cacheListPage(
  dataType: string,
  pageNumber: number | null,
  data: PageData,
  timestamp: number,
  cacheKeyOverride?: string,
  stashName?: string
): Promise<void> {
  const cacheKey = cacheKeyOverride ?? CACHE_KEYS[dataType]
  if (!cacheKey) return

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
}

async function cacheCharacterStats(
  dataType: string,
  data: Record<string, unknown>,
  masterId: string | null,
  timestamp: number,
  _url: string
): Promise<void> {
  const result = await chrome.storage.local.get(CACHE_KEYS.character_stats)
  const existing: {
    lastUpdated: number | null
    updates: Record<string, CharacterStatsEntry>
    characterCount?: number
  } = (result[CACHE_KEYS.character_stats!] as {
    lastUpdated: number | null
    updates: Record<string, CharacterStatsEntry>
    characterCount?: number
  }) ?? {
    lastUpdated: null,
    updates: {}
  }

  if (existing.lastUpdated && timestamp - existing.lastUpdated > CACHE_TTL_MS) {
    existing.updates = {}
  }

  const master = data.master as Record<string, unknown> | undefined
  const resolvedMasterId = (master?.id as string) ?? masterId
  if (!resolvedMasterId) {
    console.warn('[Background] No master_id found for character stats')
    return
  }

  const current: CharacterStatsEntry = existing.updates[resolvedMasterId] ?? {
    masterId: resolvedMasterId
  }

  if (!current.rawData) current.rawData = {}
  if (dataType === 'character_detail') {
    current.rawData.character_detail = {
      master: {
        id: master?.id,
        name: master?.name,
        attribute: master?.attribute
      },
      param: data.param,
      npc_arousal_form: data.npc_arousal_form,
      npc_arousal_form_text: data.npc_arousal_form_text,
      npc_arousal_level: data.npc_arousal_level,
      has_npcaugment_constant: data.has_npcaugment_constant,
      attribute: data.attribute,
      element: data.element
    }
  } else if (dataType === 'zenith_npc') {
    const option = data.option as Record<string, unknown> | undefined
    const npcaugment = option?.npcaugment as Record<string, unknown> | undefined
    if (npcaugment) {
      current.rawData.zenith_npc = {
        param_data: npcaugment.param_data ?? null,
        constant_data_list: npcaugment.constant_data_list ?? null
      }
    }
  }

  if (dataType === 'character_detail') {
    current.masterName = (master?.name as string) ?? current.masterName
    current.timestamp = timestamp

    const element =
      data.attribute ?? data.element ?? master?.attribute ?? master?.element
    if (element) {
      current.element = element as string | number
    }

    const param = data.param as Record<string, unknown> | undefined
    const evolution = param?.evolution
    if (evolution != null) {
      current.uncapLevel = parseInt(String(evolution), 10)
    }
    const phase = param?.phase
    if (phase != null) {
      const transcendence = parseInt(String(phase), 10)
      if (transcendence > 0) {
        current.transcendenceStep = transcendence
      }
    }

    if (data.npc_arousal_form) {
      current.awakening = {
        type: data.npc_arousal_form,
        typeName: data.npc_arousal_form_text as string | undefined,
        level: (data.npc_arousal_level as number) ?? 1
      }
    }

    if (data.has_npcaugment_constant !== undefined) {
      current.perpetuity = !!data.has_npcaugment_constant
    }
  } else if (dataType === 'zenith_npc') {
    current.timestamp = timestamp

    const masteryData = parseZenithMasteryData(data)

    if (masteryData.masterName && !current.masterName) {
      current.masterName = masteryData.masterName
    }

    if (masteryData.rings.length > 0) {
      current.rings = masteryData.rings
    }
    if (masteryData.earring) {
      current.earring = masteryData.earring
    }
    if (masteryData.perpetuityBonuses.length > 0) {
      current.perpetuityBonuses = masteryData.perpetuityBonuses
    }
  }

  existing.updates[resolvedMasterId] = current
  existing.lastUpdated = timestamp
  existing.characterCount = Object.keys(existing.updates).length

  await chrome.storage.local.set({
    [CACHE_KEYS.character_stats!]: existing
  })
}

// ==========================================
// MASTERY DATA PARSING
// ==========================================

function parseZenithMasteryData(
  data: Record<string, unknown>
): ParsedMasteryData {
  const result: ParsedMasteryData = {
    rings: [],
    earring: null,
    masterName: null,
    perpetuityBonuses: []
  }

  const option = data.option as Record<string, unknown> | undefined
  const character = option?.character as Record<string, unknown> | undefined
  if (character?.name) {
    result.masterName = character.name as string
  }

  const npcaugment = option?.npcaugment as Record<string, unknown> | undefined
  const paramData = npcaugment?.param_data
  if (Array.isArray(paramData)) {
    for (const bonus of paramData) {
      if (!bonus?.type?.id || !bonus?.param) continue

      const typeId = bonus.type.id as number
      const typeName = bonus.type.name as string
      const slotNum = bonus.slot_number as number
      const strength = parseDisplayValue(bonus.param.disp_total_param)

      if (strength === 0) continue

      if (slotNum === 1) {
        const modifierId = bonus.type.split_key === 0 ? 1 : 2
        result.rings.push({
          modifier: modifierId,
          strength,
          typeName,
          slot: slotNum
        })
        continue
      }

      if (slotNum === 5) {
        continue
      }

      if (slotNum === 4) {
        const modifierId = lookupAetherialTypeId(typeId)
        if (modifierId) {
          result.earring = { modifier: modifierId, strength, typeName }
        }
        continue
      }

      const modifierId = OVER_MASTERY_TYPE_ID[typeId]
      if (modifierId) {
        result.rings.push({
          modifier: modifierId,
          strength,
          typeName,
          slot: slotNum
        })
      }
    }
  }

  const constantData = npcaugment?.constant_data_list as
    | Record<string, unknown[]>
    | undefined
  if (constantData) {
    for (const bonuses of Object.values(constantData)) {
      if (!Array.isArray(bonuses)) continue
      for (const bonus of bonuses) {
        const b = bonus as Record<string, unknown>
        const bType = b.type as Record<string, unknown> | undefined
        const bParam = b.param as Record<string, unknown> | undefined
        if (!bType?.id || !bParam) continue
        const perpetuityId = PERPETUITY_TYPE_ID[bType.id as number]
        if (perpetuityId) {
          result.perpetuityBonuses.push({
            modifier: perpetuityId,
            strength: parseDisplayValue(
              bParam.disp_total_param as string | undefined
            ),
            typeName: bType.name as string
          })
        }
      }
    }
  }

  return result
}

// ==========================================
// UNF SCORE CACHING
// ==========================================

async function cacheUnfScores(
  eventNumber: number,
  pageNumber: number | null,
  data: unknown,
  timestamp: number,
  dataTypePrefix: string
): Promise<void> {
  const prefix = CACHE_PREFIXES[dataTypePrefix]
  if (!prefix) return
  const cacheKey = prefix + eventNumber

  const memberList = (
    data as { member_list?: { list?: unknown; last?: number } }
  )?.member_list
  if (!memberList?.list) return

  // Game returns an array for page 1 but an object keyed by index for pages 2+
  const rawList: unknown[] = Array.isArray(memberList.list)
    ? memberList.list
    : Object.values(memberList.list as Record<string, unknown>)

  if (rawList.length === 0) return

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
}

async function cacheGuildInfo(data: unknown, timestamp: number): Promise<void> {
  const guildData = data as { is_guild_in?: string }
  if (!guildData?.is_guild_in) return

  const cacheKey = CACHE_KEYS.guild_info!
  await chrome.storage.local.set({
    [cacheKey]: {
      guildId: guildData.is_guild_in,
      timestamp
    } satisfies CachedGuildInfo
  })
}

// ==========================================
// VERSION CHECK
// ==========================================

async function checkExtensionVersion(): Promise<VersionCheckResult | null> {
  try {
    const apiUrl = await getApiUrl('/version')
    const response = await fetch(apiUrl)
    if (!response.ok) return null

    const data = (await response.json()) as {
      extension?: { version?: string }
    }
    if (!data.extension?.version) return null

    const current = chrome.runtime.getManifest().version
    const latest = data.extension.version

    const isOutdated = compareVersions(current, latest) < 0
    return { isOutdated, current, latest }
  } catch {
    return null
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

interface BackgroundMessage {
  action: string
  dataType?: string
  data?: unknown
  raidSlug?: string
  raidId?: string
  playlistIds?: string[]
  name?: string
  visibility?: number
  shareWithCrew?: boolean
  selectedIndices?: number[]
  updateExisting?: boolean
  isFullInventory?: boolean
  reconcileDeletions?: boolean
  conflictResolutions?: unknown
  deletionIds?: string[]
  forceRefresh?: boolean
}

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    switch (message.action) {
      case 'checkExtensionVersion':
        checkExtensionVersion().then(sendResponse)
        return true

      case 'getCacheStatus':
        handleGetCacheStatus().then(sendResponse)
        return true

      case 'getCachedData':
        handleGetCachedData(message.dataType!).then(sendResponse)
        return true

      case 'clearCache':
        handleClearCache(message.dataType).then(sendResponse)
        return true

      case 'getDebuggerStatus':
        sendResponse({
          attached: isAttached(),
          tabs: getAttachedTabs()
        })
        return false

      case 'popOutWindow':
        if (popOutWindowId) {
          chrome.windows.update(popOutWindowId, { focused: true })
          sendResponse({ windowId: popOutWindowId, alreadyOpen: true })
        } else {
          chrome.windows.create(
            {
              url: 'sidepanel.html',
              type: 'popup',
              width: 420,
              height: 700
            },
            (win) => {
              popOutWindowId = win?.id ?? null
              sendResponse({ windowId: win?.id, alreadyOpen: false })
            }
          )
          return true
        }
        return false

      case 'fetchRaidGroups':
        fetchRaidGroups(message.forceRefresh).then(sendResponse)
        return true

      case 'fetchUserPlaylists':
        fetchUserPlaylists().then(sendResponse)
        return true

      case 'createPlaylist':
        createPlaylist(
          message.data as {
            title: string
            description: string
            visibility: number
          }
        ).then(sendResponse)
        return true

      case 'uploadPartyData':
        loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          uploadPartyData(
            data,
            message.raidSlug || message.raidId,
            message.playlistIds,
            message.name,
            message.visibility,
            message.shareWithCrew
          ).then(sendResponse)
        })
        return true

      case 'uploadDetailData':
        loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          uploadDetailData(
            data as Record<string, unknown>,
            message.dataType!
          ).then(sendResponse)
        })
        return true

      case 'getCollectionIds':
        getCollectionIds().then(sendResponse)
        return true

      case 'checkConflicts':
        loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          checkConflicts(
            data as Record<number, PageData>,
            message.dataType!
          ).then(sendResponse)
        })
        return true

      case 'uploadCollectionData':
        loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          uploadCollectionData(
            data as Record<number, PageData>,
            message.dataType!,
            {
              selectedIndices: message.selectedIndices,
              conflictResolutions: message.conflictResolutions,
              deletionIds: message.deletionIds
            }
          ).then(sendResponse)
        })
        return true

      case 'syncCollection':
        loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          uploadCollectionData(
            data as Record<number, PageData>,
            message.dataType!,
            {
              selectedIndices: message.selectedIndices,
              isFullInventory: true,
              reconcileDeletions: true,
              deletionIds: message.deletionIds
            }
          ).then(sendResponse)
        })
        return true

      case 'previewSyncDeletions':
        loadCachedDataForUpload(message.dataType!).then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          previewSyncDeletions(
            data as Record<number, PageData>,
            message.dataType!
          ).then(sendResponse)
        })
        return true

      case 'uploadCharacterStats':
        loadCachedDataForUpload('character_stats').then((data) => {
          if (!data) {
            sendResponse({ error: 'no_cached_data' })
            return
          }
          uploadCharacterStats(
            data as Record<string, CharacterStatsEntry>
          ).then(sendResponse)
        })
        return true

      case 'uploadUnfScores':
        handleUploadUnfScores(
          message.dataType!,
          (message as { round?: string }).round ?? 'preliminaries'
        ).then(sendResponse)
        return true

      case 'createCrew':
        handleCreateCrew((message as { name?: string }).name ?? '').then(
          sendResponse
        )
        return true

      case 'previewGwPhantoms':
        handlePreviewGwPhantoms(
          (message as { dataType: string }).dataType
        ).then(sendResponse)
        return true

      case 'fetchLatestGwEvent':
        handleFetchLatestGwEvent().then(sendResponse)
        return true

      default:
        return false
    }
  }
)

// ==========================================
// CACHE STATUS HANDLERS
// ==========================================

async function loadCachedDataForUpload(
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

async function handleGetCachedData(
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

async function handleGetCacheStatus(): Promise<CacheStatusResult> {
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
    const c = cached as Record<string, unknown>

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

    const dt = `${matchedPrefix}_${suffix}`
    const timestamp = (c.timestamp as number) ?? (c.lastUpdated as number)
    const age = now - timestamp
    const stale = age > CACHE_TTL_MS

    if (matchedPrefix === 'party') {
      status[dt] = {
        available: !stale,
        lastUpdated: timestamp,
        age,
        isStale: stale,
        partyId: suffix,
        partyName:
          (c.partyName as string) ?? `Party ${suffix.replace('_', '-')}`
      }
    } else if (matchedPrefix.startsWith('stash_')) {
      status[dt] = {
        available: !stale && (c.pageCount as number) > 0,
        pageCount: (c.pageCount as number) ?? 0,
        totalItems: (c.totalItems as number) ?? 0,
        lastUpdated: timestamp,
        age,
        isStale: stale,
        stashName: (c.stashName as string | null) ?? null
      }
    } else if (matchedPrefix.startsWith('detail_')) {
      status[dt] = {
        available: !stale,
        lastUpdated: timestamp,
        age,
        isStale: stale,
        granblueId: suffix,
        itemName: (c.itemName as string) ?? 'Unknown'
      }
    } else if (
      matchedPrefix === 'unf_scores' ||
      matchedPrefix === 'unf_daily_scores'
    ) {
      const unfData = c as unknown as CachedUnfScores
      status[dt] = {
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

async function handleClearCache(
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

// ==========================================
// DATA UPLOAD (to granblue.team only)
// ==========================================

function collectPageItems(pagesData: Record<number, PageData>): unknown[] {
  const items: unknown[] = []
  for (const pageData of Object.values(pagesData)) {
    if (pageData?.list && Array.isArray(pageData.list)) {
      items.push(...pageData.list)
    }
  }
  return items
}

const ENDPOINT_MAP: Record<string, string> = {
  detail_npc: 'characters',
  detail_weapon: 'weapons',
  detail_summon: 'summons',
  collection_weapon: 'weapons',
  collection_npc: 'characters',
  collection_summon: 'summons',
  collection_artifact: 'artifacts',
  list_weapon: 'weapons',
  list_npc: 'characters',
  list_summon: 'summons'
}

function resolveEndpoint(dataType: string): string | null {
  if (ENDPOINT_MAP[dataType]) return ENDPOINT_MAP[dataType]!
  if (dataType.startsWith('stash_weapon')) return 'weapons'
  if (dataType.startsWith('stash_summon')) return 'summons'
  return null
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { error?: string }
    if (json.error) return json.error
  } catch {
    /* not JSON */
  }
  return 'server_error'
}

async function authenticatedPost(
  endpoint: string,
  body: unknown
): Promise<ApiResult> {
  const auth = await getAuthToken()
  if (!auth) return { error: 'not_logged_in' }

  const apiUrl = await getApiUrl(endpoint)
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.access_token}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      return { error: await parseErrorResponse(response) }
    }

    return { data: (await response.json()) as Record<string, unknown>, auth }
  } catch {
    return { error: 'request_failed' }
  }
}

async function uploadPartyData(
  data: unknown,
  raidId?: string,
  playlistIds?: string[],
  name?: string,
  visibility?: number,
  shareWithCrew?: boolean
): Promise<UploadPartyResult> {
  const body: Record<string, unknown> = { import: data }
  if (raidId) body.raid_id = raidId
  if (playlistIds && playlistIds.length > 0) body.playlist_ids = playlistIds
  if (name) body.name = name
  if (visibility) body.visibility = visibility

  const result = await authenticatedPost('/import', body)
  if (result.error) return result

  if (shareWithCrew && result.data?.party_id) {
    await authenticatedPost(
      `/parties/${result.data.party_id}/shares`,
      {}
    ).catch(() => {})
  }

  const siteUrl = await getSiteBaseUrl()
  return {
    success: true,
    shortcode: result.data!.shortcode as string,
    url: `${siteUrl}/teams/${result.data!.shortcode}`
  }
}

async function uploadDetailData(
  data: Record<string, unknown>,
  dataType: string
): Promise<UploadDetailResult> {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: `Unknown data type: ${dataType}` }

  const auth = await getAuthToken()
  let lang = 'en'
  if (data.cjs && (data.cjs as string).includes('_jp/')) {
    lang = 'jp'
  } else if (auth?.language === 'ja') {
    lang = 'jp'
  }

  const result = await authenticatedPost(
    `/import/${endpoint}?lang=${lang}`,
    data
  )
  if (result.error) return { error: result.error }
  return { success: true, ...result.data }
}

function parseGameFilter(options: Record<string, unknown>): GameFilter | null {
  const filter = options.filter as Record<string, string> | undefined
  if (!filter) return null

  const result: GameFilter = { elements: null, proficiencies: null }

  const elementStr = filter['6']
  if (elementStr && typeof elementStr === 'string' && elementStr !== '000000') {
    result.elements = []
    const elementMap = [2, 3, 4, 1, 6, 5]
    for (let i = 0; i < elementStr.length; i++) {
      if (elementStr[i] === '1') {
        result.elements.push(elementMap[i]!)
      }
    }
    if (result.elements.length === 0) result.elements = null
  }

  const profMap = [1, 2, 4, 3, 6, 9, 7, 5, 8, 10]
  const profStr = filter['8']
  if (profStr && typeof profStr === 'string' && profStr !== '0000000000') {
    result.proficiencies = []
    for (let i = 0; i < profStr.length; i++) {
      if (profStr[i] === '1') {
        result.proficiencies.push(profMap[i]!)
      }
    }
    if (result.proficiencies.length === 0) result.proficiencies = null
  }

  if (!result.elements && !result.proficiencies) return null
  return result
}

function extractFilterFromPages(
  pagesData: Record<number, PageData>
): GameFilter | null {
  for (const pageData of Object.values(pagesData)) {
    if (pageData?.options?.filter || pageData?.option?.filter) {
      const options = (pageData.options ?? pageData.option) as Record<
        string,
        unknown
      >
      return parseGameFilter(options)
    }
  }
  return null
}

async function previewSyncDeletions(
  pagesData: Record<number, PageData>,
  dataType: string
): Promise<SyncPreviewResult> {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: 'unknown_type' }

  const allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'no_items' }

  const activeFilter = extractFilterFromPages(pagesData)
  const result = await authenticatedPost(
    `/collection/${endpoint}/preview_sync`,
    {
      data: { list: allItems },
      filter: activeFilter
    }
  )
  if (result.error) return { error: result.error }
  return {
    willDelete: (result.data!.will_delete as unknown[]) ?? [],
    count: (result.data!.count as number) ?? 0
  }
}

async function checkConflicts(
  pagesData: Record<number, PageData>,
  dataType: string
): Promise<ConflictCheckResult> {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: 'unknown_type' }

  const allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'no_items' }

  const result = await authenticatedPost(
    `/collection/${endpoint}/check_conflicts`,
    { data: { list: allItems } }
  )
  if (result.error) return { error: result.error }
  return { conflicts: (result.data!.conflicts as unknown[]) ?? [] }
}

async function uploadCollectionData(
  pagesData: Record<number, PageData>,
  dataType: string,
  options: UploadCollectionOptions = {}
): Promise<UploadCollectionResult> {
  const {
    updateExisting = false,
    isFullInventory = false,
    reconcileDeletions = false,
    conflictResolutions = null,
    selectedIndices,
    deletionIds
  } = options

  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: 'unknown_type' }

  let allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'no_items' }

  if (selectedIndices && selectedIndices.length > 0) {
    allItems = selectedIndices
      .filter((i) => i >= 0 && i < allItems.length)
      .map((i) => allItems[i]!)
  }

  const activeFilter = extractFilterFromPages(pagesData)
  const body: Record<string, unknown> = {
    data: { list: allItems },
    update_existing: updateExisting,
    is_full_inventory: isFullInventory,
    reconcile_deletions: reconcileDeletions,
    filter: activeFilter
  }

  if (conflictResolutions) {
    body.conflict_resolutions = conflictResolutions
  }
  if (deletionIds && deletionIds.length > 0) {
    body.deletion_ids = deletionIds
  }

  const result = await authenticatedPost(`/collection/${endpoint}/import`, body)
  if (result.error) return { error: result.error }

  collectionIdsCache = null

  return {
    success: result.data!.success as boolean,
    created: (result.data!.created as number) ?? 0,
    updated: (result.data!.updated as number) ?? 0,
    skipped: (result.data!.skipped as number) ?? 0,
    errors: (result.data!.errors as unknown[]) ?? [],
    reconciliation: result.data!.reconciliation ?? null
  }
}

async function uploadCharacterStats(
  statsData: Record<string, CharacterStatsEntry>
): Promise<UploadCollectionResult> {
  const items = Object.values(statsData).map((char) => {
    const item: Record<string, unknown> = { granblue_id: char.masterId }

    if (char.uncapLevel !== undefined) {
      item.uncap_level = char.uncapLevel
    }
    if (char.transcendenceStep !== undefined) {
      item.transcendence_step = char.transcendenceStep
    }

    if (char.awakening) {
      item.awakening_type = char.awakening.type
      item.awakening_level = char.awakening.level
    }

    if (char.rings && char.rings.length > 0) {
      char.rings.forEach((ring, i) => {
        if (ring?.modifier) {
          item[`ring${i + 1}`] = {
            modifier: ring.modifier,
            strength: ring.strength
          }
        }
      })
    }

    if (char.earring?.modifier) {
      item.earring = {
        modifier: char.earring.modifier,
        strength: char.earring.strength
      }
    }

    if (char.perpetuity !== undefined) {
      item.perpetuity = char.perpetuity
    }

    return item
  })

  if (items.length === 0) {
    return { error: 'no_items' }
  }

  const result = await authenticatedPost('/collection/characters/import', {
    data: { list: items },
    update_existing: true
  })
  if (result.error) return { error: result.error }

  collectionIdsCache = null

  return {
    success: result.data!.success as boolean,
    created: (result.data!.created as number) ?? 0,
    updated: (result.data!.updated as number) ?? 0,
    skipped: (result.data!.skipped as number) ?? 0,
    errors: (result.data!.errors as unknown[]) ?? []
  }
}

async function handleUploadUnfScores(
  dataType: string,
  round: string
): Promise<{
  success?: boolean
  imported?: number
  phantomsCreated?: number
  errors?: unknown[]
  error?: string
}> {
  const cacheKey = resolveCacheKey(dataType)
  if (!cacheKey) return { error: 'unknown_type' }

  const stored = await chrome.storage.local.get(cacheKey)
  const cached = stored[cacheKey] as CachedUnfScores | undefined
  if (!cached || cached.memberCount === 0) return { error: 'no_cached_data' }

  const allMembers: UnfMember[] = []
  for (const page of Object.values(cached.pages)) {
    allMembers.push(...page)
  }

  const isCumulative = dataType.startsWith('unf_scores_')

  const result = await authenticatedPost('/crew/import_gw_scores', {
    event_number: cached.eventNumber,
    round,
    is_cumulative: isCumulative,
    members: allMembers.map((m) => ({
      granblue_id: m.id,
      name: m.name,
      score: m.contribution
    }))
  })

  if (result.error) return { error: result.error }

  const data = result.data!
  return {
    success: true,
    imported: data.imported as number,
    phantomsCreated: data.phantoms_created as number,
    errors: (data.errors as unknown[]) ?? []
  }
}

async function handlePreviewGwPhantoms(
  dataType: string
): Promise<{
  existingPhantomIds?: string[]
  newPhantomIds?: string[]
  error?: string
}> {
  const cacheKey = resolveCacheKey(dataType)
  if (!cacheKey) return { error: 'unknown_type' }

  const stored = await chrome.storage.local.get(cacheKey)
  const cached = stored[cacheKey] as CachedUnfScores | undefined
  if (!cached || cached.memberCount === 0) return { error: 'no_cached_data' }

  const allMembers: UnfMember[] = []
  for (const page of Object.values(cached.pages)) {
    allMembers.push(...page)
  }

  const result = await authenticatedPost('/crew/preview_gw_phantoms', {
    granblue_ids: allMembers.map((m) => m.id)
  })

  if (result.error) return { error: result.error }
  const data = result.data as {
    existing_phantom_ids: string[]
    new_phantom_ids: string[]
  }
  return {
    existingPhantomIds: data.existing_phantom_ids,
    newPhantomIds: data.new_phantom_ids
  }
}

async function handleCreateCrew(
  name: string
): Promise<{ success?: boolean; crew?: unknown; error?: string }> {
  const guildResult = await chrome.storage.local.get(CACHE_KEYS.guild_info!)
  const guildInfo = guildResult[CACHE_KEYS.guild_info!] as
    | CachedGuildInfo
    | undefined
  const guildId = guildInfo?.guildId

  const body: Record<string, unknown> = { crew: { name } }
  if (guildId) {
    ;(body.crew as Record<string, unknown>).granblue_crew_id = guildId
  }

  const result = await authenticatedPost('/crews', body)
  if (result.error) {
    if (result.error.includes('granblue_crew_id')) {
      return { error: 'crew_already_exists' }
    }
    return { error: result.error }
  }

  // Update stored auth to reflect new crew
  const authResult = await chrome.storage.local.get('gbAuth')
  const auth = authResult.gbAuth as Record<string, unknown> | undefined
  if (auth) {
    auth.hasCrew = true
    await chrome.storage.local.set({ gbAuth: auth })
  }

  return { success: true, crew: result.data }
}

async function handleFetchLatestGwEvent(): Promise<FetchLatestGwEventResponse> {
  try {
    const apiUrl = await getApiUrl('/gw_events/status')
    const response = await fetch(apiUrl)
    if (!response.ok) return { error: 'request_failed' }

    const data = (await response.json()) as {
      upcoming: {
        event_number: number
        start_date: string
        end_date: string
      } | null
      recent: {
        event_number: number
        start_date: string
        end_date: string
      } | null
    }

    return {
      recent: data.recent
        ? {
            eventNumber: data.recent.event_number,
            startDate: data.recent.start_date,
            endDate: data.recent.end_date
          }
        : null,
      upcoming: data.upcoming
        ? {
            eventNumber: data.upcoming.event_number,
            startDate: data.upcoming.start_date,
            endDate: data.upcoming.end_date
          }
        : null
    }
  } catch {
    return { error: 'request_failed' }
  }
}

async function fetchUserPlaylists(): Promise<FetchPlaylistsResult> {
  try {
    const auth = await getAuthToken()
    if (!auth) return { error: 'not_logged_in' }

    const response = await fetch(
      await getApiUrl(`/users/${auth.user.username}/playlists?per_page=100`),
      {
        headers: { Authorization: `Bearer ${auth.access_token}` }
      }
    )
    if (!response.ok) throw new Error('request_failed')
    const data = await response.json()
    return { data }
  } catch (error) {
    console.error('Failed to fetch playlists:', error)
    return { error: 'request_failed' }
  }
}

async function createPlaylist({
  title,
  description,
  visibility
}: {
  title: string
  description: string
  visibility: number
}): Promise<CreatePlaylistResult> {
  try {
    const result = await authenticatedPost('/playlists', {
      playlist: { title, description, visibility: visibility || 3 }
    })
    return result
  } catch (error) {
    console.error('Failed to create playlist:', error)
    return { error: 'request_failed' }
  }
}

async function fetchRaidGroups(
  forceRefresh = false
): Promise<FetchRaidGroupsResult> {
  const cacheKey = CACHE_KEYS.raid_groups!
  const result = await chrome.storage.local.get(cacheKey)
  const cached = result[cacheKey] as
    | { timestamp: number; data: unknown }
    | undefined

  if (
    !forceRefresh &&
    cached?.timestamp &&
    Date.now() - cached.timestamp < RAID_GROUPS_CACHE_TTL_MS
  ) {
    return { data: cached.data }
  }

  const auth = await getAuthToken()
  if (!auth) return { error: 'not_logged_in' }

  const apiUrl = await getApiUrl('/raid_groups')
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.access_token}`
      }
    })

    if (!response.ok) {
      return { error: await parseErrorResponse(response) }
    }

    const data = await response.json()

    await chrome.storage.local.set({
      [cacheKey]: { data, timestamp: Date.now() }
    })

    return { data }
  } catch {
    return { error: 'request_failed' }
  }
}

async function getCollectionIds(): Promise<{
  error?: string
  weapons?: string[]
  summons?: string[]
  characters?: string[]
  artifacts?: string[]
}> {
  const now = Date.now()
  if (
    collectionIdsCache &&
    now - collectionIdsCacheTime < COLLECTION_IDS_TTL_MS
  ) {
    return collectionIdsCache
  }

  const auth = await getAuthToken()
  if (!auth) return { error: 'not_logged_in' }

  const userId = auth.user?.id
  if (!userId) return { error: 'not_logged_in' }

  const apiUrl = await getApiUrl(`/users/${userId}/collection/game_ids`)
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.access_token}`
      }
    })

    if (!response.ok) return { error: 'request_failed' }

    const data = await response.json()
    collectionIdsCache = data
    collectionIdsCacheTime = now
    return data
  } catch {
    return { error: 'request_failed' }
  }
}

async function getAuthToken(): Promise<AuthToken | null> {
  const result = await chrome.storage.local.get('gbAuth')
  const auth = result.gbAuth as AuthToken | undefined

  if (!auth?.access_token) {
    return null
  }

  if (auth.expires_at && Date.now() > auth.expires_at) {
    return null
  }

  return auth
}
