/**
 * @fileoverview Shared constants for the Granblue Fantasy Chrome extension.
 * Centralizes all configuration values, URLs, and data type definitions.
 */

// ==========================================
// API CONFIGURATION
// ==========================================

export const API_URLS = {
  production: 'https://api.granblue.team',
  staging: 'https://next-api.granblue.team'
}

export const SITE_URLS = {
  production: 'https://granblue.team',
  staging: 'https://next.granblue.team'
}

/**
 * Get the API base URL for the selected site
 * @param {string} site - 'production' or 'staging'
 * @returns {string} The API base URL
 */
export function getApiBaseUrl(site = 'production') {
  return API_URLS[site] || API_URLS.production
}

/**
 * Get the site base URL (for party links, etc.)
 * @param {string} site - 'production' or 'staging'
 * @returns {string} The site base URL
 */
export function getSiteBaseUrl(site = 'production') {
  return SITE_URLS[site] || SITE_URLS.production
}

// ==========================================
// CACHE CONFIGURATION
// ==========================================

/** How long cached data is considered fresh (30 minutes) */
export const CACHE_TTL_MS = 30 * 60 * 1000

/** Cache key prefixes for different data types */
export const CACHE_KEYS = {
  party: 'gbf_cache_party',
  detail_npc: 'gbf_cache_detail_npc',
  detail_weapon: 'gbf_cache_detail_weapon',
  detail_summon: 'gbf_cache_detail_summon',
  list_npc: 'gbf_cache_list_npc',
  list_weapon: 'gbf_cache_list_weapon',
  list_summon: 'gbf_cache_list_summon',
  collection_weapon: 'gbf_cache_collection_weapon',
  collection_npc: 'gbf_cache_collection_npc',
  collection_summon: 'gbf_cache_collection_summon',
  collection_artifact: 'gbf_cache_collection_artifact'
}

// ==========================================
// DATA TYPE DEFINITIONS
// ==========================================

/**
 * Data type metadata including display names
 */
export const DATA_TYPES = {
  party: { name: 'Party' },
  detail_npc: { name: 'Character' },
  detail_weapon: { name: 'Weapon' },
  detail_summon: { name: 'Summon' },
  list_npc: { name: 'Character List' },
  list_weapon: { name: 'Weapon List' },
  list_summon: { name: 'Summon List' },
  collection_weapon: { name: 'Weapon Collection' },
  collection_npc: { name: 'Character Collection' },
  collection_summon: { name: 'Summon Collection' },
  collection_artifact: { name: 'Artifact Collection' }
}

/**
 * Get display name for a data type
 * @param {string} dataType - The data type key
 * @returns {string} Human-readable name
 */
export function getDataTypeName(dataType) {
  return DATA_TYPES[dataType]?.name || dataType
}

/** Display order for data types in UI */
export const DATA_TYPE_ORDER = [
  'party',
  'detail_npc', 'detail_weapon', 'detail_summon',
  'collection_npc', 'collection_weapon', 'collection_summon', 'collection_artifact',
  'list_npc', 'list_weapon', 'list_summon'
]

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
