export interface AuthToken {
  access_token: string
  user: { id: string; username: string }
  expires_at?: number
  language?: string
}

export interface CachedListData {
  pages: Record<number, PageData>
  lastUpdated: number | null
  stashName?: string
  totalPages?: number
  totalItems?: number
  pageCount?: number
  isComplete?: boolean
}

export interface PageData {
  list?: unknown[]
  option?: { total_page?: number; filter?: Record<string, string> }
  options?: { filter?: Record<string, string> }
  current?: number
}

export interface MasteryMod {
  modifier: number
  strength: number
  typeName?: string
  slot?: number
}

export interface CharacterStatsEntry {
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

export interface ParsedMasteryData {
  rings: MasteryMod[]
  earring: MasteryMod | null
  masterName: string | null
  perpetuityBonuses: MasteryMod[]
}

export interface GameFilter {
  elements: number[] | null
  proficiencies: number[] | null
}

export interface UploadCollectionOptions {
  updateExisting?: boolean
  isFullInventory?: boolean
  reconcileDeletions?: boolean
  conflictResolutions?: unknown
  selectedIndices?: number[]
  deletionIds?: string[]
}

export interface ApiResult<T = Record<string, unknown>> {
  error?: string
  data?: T
  auth?: AuthToken
}

export interface UploadPartyResult {
  success?: boolean
  shortcode?: string
  url?: string
  error?: string
}

export interface UploadDetailResult {
  success?: boolean
  error?: string
  [key: string]: unknown
}

export interface UploadCollectionResult {
  success?: boolean
  created?: number
  updated?: number
  skipped?: number
  errors?: unknown[]
  reconciliation?: unknown
  error?: string
}

export interface ConflictCheckResult {
  conflicts?: unknown[]
  error?: string
}

export interface UpdateCheckResult {
  updates?: unknown[]
  error?: string
}

export interface SyncPreviewResult {
  willDelete?: unknown[]
  count?: number
  error?: string
}

export interface CachedDataResult {
  data?: Record<string, unknown> | Record<number, unknown>
  error?: string
  timestamp?: number
  age?: number
  dataType?: string
  pageCount?: number
  totalItems?: number
  characterCount?: number
}

export interface CacheStatusEntry {
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

export interface CacheStatusResult {
  _debugger: { attached: boolean; tabs: number[] }
  [key: string]: CacheStatusEntry | { attached: boolean; tabs: number[] }
}

export interface FetchPlaylistsResult {
  data?: unknown
  error?: string
}

export interface FetchRaidGroupsResult {
  data?: unknown
  error?: string
}

export interface FetchElementVariantsResult {
  data?: unknown
  error?: string
}

export interface CreatePlaylistResult {
  data?: Record<string, unknown>
  error?: string
}

export interface VersionCheckResult {
  isOutdated: boolean
  current: string
  latest: string
}

export interface CachedUnfScores {
  eventNumber: number
  pages: Record<number, UnfMember[]>
  lastUpdated: number
  totalPages: number
  pageCount: number
  memberCount: number
  isComplete: boolean
}

export interface UnfMember {
  id: string
  name: string
  contribution: number
  rank: number
  level: string
}

export interface CachedGuildInfo {
  guildId: string
  timestamp: number
}

export interface BackgroundMessage {
  action: string
  dataType?: string
  data?: unknown
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
