/**
 * @fileoverview Shared constants for the Granblue Fantasy Chrome extension.
 * Centralizes all configuration values, URLs, and data type definitions.
 */

import { safeGet } from './storage.js'
import { t } from './i18n.js'

// ==========================================
// API CONFIGURATION
// ==========================================

export const ENVIRONMENTS = {
  production: {
    apiUrl: 'https://api.granblue.team',
    siteUrl: 'https://granblue.team',
    apiPath: '/v1'
  },
  development: {
    apiUrl: 'https://api.granblue.team',
    siteUrl: 'https://granblue.team',
    apiPath: '/v1'
  }
}

export const IMG_URL = 'https://siero-img.s3-us-west-2.amazonaws.com'

/**
 * Get full image URL for a path
 * @param {string} path - Image path (e.g., 'port-breeze.jpg', 'profile/npc@2x.png')
 * @returns {string} Full image URL
 */
export function getImageUrl(path) {
  return `${IMG_URL}/${path}`
}

/** Default environment */
export const DEFAULT_ENV = 'development'

/**
 * Get environment config from storage
 * @returns {Promise<Object>} Environment configuration
 */
export async function getEnvConfig() {
  const { appEnv } = await safeGet('appEnv')
  const env = appEnv || DEFAULT_ENV
  return { env, ...ENVIRONMENTS[env] }
}

/**
 * Get the full API URL with path prefix
 * @param {string} endpoint - API endpoint (e.g., '/import', '/collection/artifacts/import')
 * @returns {Promise<string>} Full API URL
 */
export async function getApiUrl(endpoint) {
  const config = await getEnvConfig()
  return `${config.apiUrl}${config.apiPath}${endpoint}`
}

/**
 * Get the site base URL (for party links, etc.)
 * @returns {Promise<string>} The site base URL
 */
export async function getSiteBaseUrl() {
  const config = await getEnvConfig()
  return config.siteUrl
}

// ==========================================
// CACHE CONFIGURATION
// ==========================================

/** How long cached data is considered fresh (30 minutes) */
export const CACHE_TTL_MS = 30 * 60 * 1000

/** How long raid groups cache is considered fresh (1 day) */
export const RAID_GROUPS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Granblue Fantasy CDN for game assets (new items not yet on S3) */
export const GBF_CDN =
  'https://prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/assets'

/** Cache storage keys for static (non-dynamic) data types */
export const CACHE_KEYS = {
  list_npc: 'gbf_cache_list_npc',
  list_weapon: 'gbf_cache_list_weapon',
  list_summon: 'gbf_cache_list_summon',
  collection_weapon: 'gbf_cache_collection_weapon',
  collection_npc: 'gbf_cache_collection_npc',
  collection_summon: 'gbf_cache_collection_summon',
  collection_artifact: 'gbf_cache_collection_artifact',
  character_stats: 'gbf_cache_character_stats',
  raid_groups: 'gbf_cache_raid_groups'
}

/** Cache key prefixes for dynamic data types (appended with ID/number) */
export const CACHE_PREFIXES = {
  party: 'gbf_cache_party_',
  stash_weapon: 'gbf_cache_stash_weapon_',
  stash_summon: 'gbf_cache_stash_summon_',
  detail_npc: 'gbf_cache_detail_npc_',
  detail_weapon: 'gbf_cache_detail_weapon_',
  detail_summon: 'gbf_cache_detail_summon_'
}

/**
 * Resolve a dataType string to its chrome.storage cache key.
 * Handles both static types (e.g., 'list_npc') and dynamic types (e.g., 'party_1_2', 'detail_npc_123').
 * @param {string} dataType - The data type identifier
 * @returns {string|null} The cache storage key, or null if unknown
 */
export function resolveCacheKey(dataType) {
  // Exact match for static keys
  if (CACHE_KEYS[dataType]) return CACHE_KEYS[dataType]

  // Dynamic prefix match: find the longest matching prefix
  for (const [prefix, cachePrefix] of Object.entries(CACHE_PREFIXES)) {
    if (dataType.startsWith(prefix + '_')) {
      const suffix = dataType.slice(prefix.length + 1)
      return cachePrefix + suffix
    }
  }

  return null
}

// ==========================================
// RAID SECTIONS
// ==========================================

export const RAID_SECTIONS = {
  FARMING: 0,
  RAID: 1,
  EVENT: 2,
  SOLO: 3
}

// ==========================================
// DATA TYPE DEFINITIONS
// ==========================================

/** i18n keys for data type names */
const DATA_TYPE_I18N_KEYS = {
  party: 'type_party',
  detail_npc: 'type_character',
  detail_weapon: 'type_weapon',
  detail_summon: 'type_summon',
  list_npc: 'type_character_list',
  list_weapon: 'type_weapon_list',
  list_summon: 'type_summon_list',
  collection_weapon: 'type_weapon_collection',
  collection_npc: 'type_character_collection',
  collection_summon: 'type_summon_collection',
  collection_artifact: 'type_artifact_collection',
  character_stats: 'type_character_stats'
}

/**
 * Get display name for a data type
 * @param {string} dataType - The data type key
 * @returns {string} Human-readable name
 */
export function getDataTypeName(dataType) {
  const key = DATA_TYPE_I18N_KEYS[dataType]
  if (key) return t(key)
  if (dataType.startsWith('stash_weapon_')) {
    return t('type_weapon_stash')
  }
  if (dataType.startsWith('stash_summon_')) {
    return t('type_summon_stash')
  }
  return dataType
}

/** Display order for data types in UI */
export const DATA_TYPE_ORDER = [
  'detail_npc',
  'detail_weapon',
  'detail_summon',
  'collection_npc',
  'collection_weapon',
  'collection_summon',
  'collection_artifact',
  'list_npc',
  'list_weapon',
  'list_summon'
]

/** Data types grouped by tab (party and database types are discovered dynamically) */
export const TAB_DATA_TYPES = {
  party: [], // Parties are dynamic - populated from cache status
  collection: [
    'character_stats', // Character extended stats (awakening, mastery bonuses)
    'collection_npc',
    'collection_weapon',
    'collection_summon',
    'collection_artifact',
    'list_npc',
    'list_weapon',
    'list_summon'
  ],
  database: [] // Database items are dynamic - populated from cache status (like parties)
}

// ==========================================
// TIMING CONSTANTS
// ==========================================

export const TIMEOUTS = {
  /** How long to show status messages */
  statusMessage: 2000,
  /** Delay after successful login before closing pane */
  loginSuccess: 1500,
  /** Duration of shake animation */
  shakeAnimation: 600,
  /** Base delay for script initialization retries */
  scriptInitBase: 50,
  /** Max attempts for script initialization */
  scriptInitMaxAttempts: 10
}
