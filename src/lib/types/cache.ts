/** Shape of a cache entry stored in chrome.storage.local */
export interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
  version?: string
}

/** Cache status info returned by background for a data type */
export interface CacheStatusInfo {
  available: boolean
  isStale: boolean
  age: number
  timestamp?: number
  totalItems?: number
  pageCount?: number
  itemName?: string
  stashName?: string
  partyName?: string
  partyId?: string
  gbfUserId?: string | null
  /** Solomonis runs: the report ID and which of its two logs are captured */
  reportId?: string
  hasReport?: boolean
  hasBook?: boolean
}

/** Formatted cache status for display in the UI */
export interface FormattedCacheStatus extends CacheStatusInfo {
  displayName: string
  subtitle: string | null
  ageText: string
  statusClass: 'available' | 'stale' | 'unavailable'
}
