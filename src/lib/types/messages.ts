/**
 * Discriminated union for messages between popup and background
 * via chrome.runtime.sendMessage.
 */

export type ExtensionMessage =
  | { action: 'getCacheStatus' }
  | { action: 'getCachedData'; dataType: string }
  | { action: 'clearCache' }
  | { action: 'importItems'; data: unknown; dataType: string }
  | { action: 'previewSyncDeletions'; data: unknown; dataType: string }
  | {
      action: 'confirmSync'
      data: unknown
      dataType: string
      deletions: unknown
    }
  | { action: 'popOutWindow' }
  | { action: 'fetchRaidGroups' }
  | { action: 'uploadUnfScores'; dataType: string; round: string }
  | { action: 'createCrew'; name: string }
  | { action: 'fetchLatestGwEvent' }
  | { action: 'previewGwPhantoms'; dataType: string }
  | { action: 'checkCollectionUpdates'; data: unknown; dataType: string }
  | { action: 'checkCharacterStatsUpdates'; data: unknown }

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

/** Response from uploadPartyData */
export interface UploadPartyResponse {
  success?: boolean
  shortcode?: string
  url?: string
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
