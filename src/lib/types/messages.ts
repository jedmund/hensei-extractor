/**
 * Every message the side panel sends to the background worker via
 * chrome.runtime.sendMessage. The background router is keyed off this union,
 * so adding an action here without a handler is a type error.
 */
export type ExtensionMessage =
  | { action: 'checkExtensionVersion' }
  | { action: 'getAuth' }
  | { action: 'getCacheStatus' }
  | { action: 'getCachedData'; dataType: string }
  | { action: 'clearCache'; dataType?: string }
  | { action: 'getDebuggerStatus' }
  | { action: 'popOutWindow' }
  | { action: 'fetchRaidGroups'; forceRefresh?: boolean }
  | { action: 'fetchElementVariants'; forceRefresh?: boolean }
  | { action: 'fetchUserPlaylists' }
  | {
      action: 'createPlaylist'
      data: { title: string; description?: string; visibility?: number }
    }
  | { action: 'getCollectionIds' }
  | { action: 'searchSummonByName'; name: string }
  | { action: 'fetchWeaponKeyMap'; locale: UiLocale }
  | { action: 'fetchWeaponStatModifiers' }
  | { action: 'fetchJobSkillSlugs'; names: string[] }
  | {
      action: 'uploadPartyData'
      dataType: string
      name?: string
      raidId?: string
      visibility?: number
      shareWithCrew?: boolean
      playlistIds?: string[]
    }
  | { action: 'uploadDetailData'; dataType: string }
  | { action: 'checkConflicts'; dataType: string; selectedIndices?: number[] }
  | { action: 'checkCollectionUpdates'; dataType: string }
  | { action: 'checkCharacterStatsUpdates' }
  | {
      action: 'uploadCollectionData'
      dataType: string
      selectedIndices?: number[]
      conflictResolutions?: Record<string, 'import' | 'skip'> | null
      deletionIds?: string[]
    }
  | {
      action: 'syncCollection'
      dataType: string
      selectedIndices?: number[]
      deletionIds?: string[]
    }
  | { action: 'previewSyncDeletions'; dataType: string }
  | { action: 'uploadCharacterStats'; selectedIndices?: number[] }
  | { action: 'uploadUnfScores'; dataType: string; round?: string }
  | { action: 'createCrew'; name?: string }
  | { action: 'previewGwPhantoms'; dataType: string }
  | { action: 'fetchLatestGwEvent' }
  | { action: 'uploadSupportSummons' }

export type ExtensionAction = ExtensionMessage['action']

export type MessageOf<A extends ExtensionAction> = Extract<
  ExtensionMessage,
  { action: A }
>

export interface ExtensionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

// ==========================================
// Service-layer response types
// ==========================================

/** Response from getCachedData — shape varies by dataType */
export interface CachedDataResponse {
  data?: Record<string, unknown> | Record<number, unknown>
  error?: string
  timestamp?: number
  age?: number
  dataType?: string
  pageCount?: number
  totalItems?: number
  characterCount?: number
}

/** A crew member's score in getCachedData's unf_scores_* data */
export interface UnfScoreMember {
  id: string
  name: string
  contribution: number
  rank: number
  level: string
}

/** getCachedData's data for unf_scores_* and unf_daily_scores_*, ranked */
export interface UnfScoresData {
  eventNumber: number
  members: UnfScoreMember[]
  totalPages: number
  pageCount: number
  isComplete: boolean
}

/** Response from uploadPartyData */
export interface ImportWarning {
  code: string
  type: string
  position: number
  granblue_id?: string | null
  name?: string | null
  details?: string[]
}

export interface UploadPartyResponse {
  success?: boolean
  shortcode?: string
  url?: string
  warnings?: ImportWarning[]
  /** The party was imported but sharing it with the crew failed */
  shareFailed?: boolean
  error?: string
}

/** Response from uploadDetailData */
export interface UploadDetailResponse {
  success?: boolean
  error?: string
  [key: string]: unknown
}

/** Response from uploadCollectionData / uploadCharacterStats */
export interface UploadCollectionResponse {
  success?: boolean
  created?: number
  updated?: number
  skipped?: number
  errors?: unknown[]
  reconciliation?: unknown
  error?: string
}

/** Response from uploadSupportSummons */
export interface UploadSupportSummonsResponse {
  success?: boolean
  created?: number
  error?: string
  /** granblue_ids granblue.team doesn't have yet, when error is 'unknown_summons' */
  unknownSummons?: string[]
}

/** Response from checkConflicts */
export interface CheckConflictsResponse {
  conflicts?: unknown[]
  error?: string
}

/** A single field-level change returned by check_updates */
export interface CollectionChangeField {
  field: string
  label: string
  before: { raw: unknown; display: string }
  after: { raw: unknown; display: string }
}

/** One record's worth of pending changes, keyed by game_id/granblue_id */
export interface CollectionUpdate {
  game_id?: string
  granblue_id: string
  changes: CollectionChangeField[]
}

/** Response from checkCollectionUpdates / checkCharacterStatsUpdates */
export interface CheckUpdatesResponse {
  updates?: CollectionUpdate[]
  error?: string
}

/** Response from previewSyncDeletions */
export interface PreviewSyncDeletionsResponse {
  willDelete?: unknown[]
  count?: number
  error?: string
}

/** A raid within a raid group */
export interface RaidEntry {
  id: string | number
  name: { en?: string; ja?: string }
  slug?: string
  level?: number
  element?: number
  group_id?: string | number
}

/** A raid group from the API */
export interface RaidGroup {
  id: string | number
  name: { en?: string; ja?: string }
  section: number | string
  difficulty: number
  extra?: boolean
  raids?: RaidEntry[]
}

/** Response from fetchRaidGroups */
export interface FetchRaidGroupsResponse {
  data?: RaidGroup[]
  error?: string
}

/** A weapon's element-variant ID map (element index → game variant ID) */
export interface ElementVariantEntry {
  id?: string
  granblue_id: string
  element_variant_ids: Record<string, string>
}

/** Response from fetchElementVariants */
export interface FetchElementVariantsResponse {
  data?: ElementVariantEntry[]
  error?: string
}

/** A playlist from the API */
export interface Playlist {
  id: string | number
  title?: string
  description?: string
  visibility?: number
}

/** Response from fetchUserPlaylists */
export interface FetchPlaylistsResponse {
  data?: Playlist[] | { results?: Playlist[] }
  error?: string
}

/** Response from createPlaylist */
export interface CreatePlaylistResponse {
  data?: Playlist
  error?: string
}

/** Response from getCollectionIds */
export interface CollectionIdsResponse {
  weapons?: string[]
  summons?: string[]
  characters?: string[]
  artifacts?: string[]
  error?: string
}

/** The side panel's display language */
export type UiLocale = 'en' | 'ja'

/** A summon from POST /search/summons, as searchSummonByName returns it */
export interface SummonSearchResult {
  granblue_id?: string
  name?: { en?: string; ja?: string }
  uncap?: { flb?: boolean; ulb?: boolean; transcendence?: boolean }
}

/** Weapon key skill id → the key's slug and localized name */
export type WeaponKeyMap = Record<string, { slug: string; name: string }>

/** A weapon stat modifier's names, keyed by slug in WeaponStatModifiers */
export interface WeaponStatModifier {
  nameEn?: string
  nameJp?: string
  suffix?: string
  [key: string]: unknown
}

export type WeaponStatModifiers = Record<string, WeaponStatModifier>

/** Job skill name → slug, or null when the API doesn't know the skill */
export type JobSkillSlugs = Record<string, string | null>

/** Response from uploadUnfScores */
export interface UploadUnfScoresResponse {
  success?: boolean
  imported?: number
  phantomsCreated?: number
  errors?: unknown[]
  error?: string
}

/** Response from createCrew */
export interface CreateCrewResponse {
  success?: boolean
  crew?: unknown
  error?: string
}

/** A GW event summary from the status endpoint */
export interface GwEventSummary {
  eventNumber: number
  startDate: string
  endDate: string
}

/** Response from fetchLatestGwEvent (GET /gw_events/status) */
export interface FetchLatestGwEventResponse {
  recent?: GwEventSummary | null
  upcoming?: GwEventSummary | null
  error?: string
}

/** Response from previewGwPhantoms */
export interface PreviewGwPhantomsResponse {
  existingPhantomIds?: string[]
  newPhantomIds?: string[]
  error?: string
}

/** Response from checkExtensionVersion */
export interface CheckVersionResponse {
  isOutdated?: boolean
  current?: string
  latest?: string
  error?: string
}
