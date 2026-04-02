/**
 * Shared constants for the Granblue Fantasy Chrome extension.
 * Centralizes all configuration values, URLs, and data type definitions.
 */

import { safeGet } from './storage.js'
import { t } from './i18n.js'

// ==========================================
// API CONFIGURATION
// ==========================================

interface EnvironmentConfig {
  apiUrl: string
  siteUrl: string
  apiPath: string
}

export const ENVIRONMENTS: Record<string, EnvironmentConfig> = {
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

export function getImageUrl(path: string): string {
  return `${IMG_URL}/${path}`
}

export const DEFAULT_ENV = 'development'

export async function getEnvConfig(): Promise<
  EnvironmentConfig & { env: string }
> {
  const { appEnv } = await safeGet<{ appEnv?: string }>('appEnv')
  const env = appEnv ?? DEFAULT_ENV
  return { env, ...ENVIRONMENTS[env]! }
}

export async function getApiUrl(endpoint: string): Promise<string> {
  const config = await getEnvConfig()
  return `${config.apiUrl}${config.apiPath}${endpoint}`
}

export async function getSiteBaseUrl(): Promise<string> {
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
export const CACHE_KEYS: Record<string, string> = {
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
export const CACHE_PREFIXES: Record<string, string> = {
  party: 'gbf_cache_party_',
  stash_weapon: 'gbf_cache_stash_weapon_',
  stash_summon: 'gbf_cache_stash_summon_',
  detail_npc: 'gbf_cache_detail_npc_',
  detail_weapon: 'gbf_cache_detail_weapon_',
  detail_summon: 'gbf_cache_detail_summon_'
}

export function resolveCacheKey(dataType: string): string | null {
  if (CACHE_KEYS[dataType]) return CACHE_KEYS[dataType]!

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
} as const

// ==========================================
// DATA TYPE DEFINITIONS
// ==========================================

const DATA_TYPE_I18N_KEYS: Record<string, string> = {
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

export function getDataTypeName(dataType: string): string {
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
] as const

export const TAB_DATA_TYPES: Record<string, string[]> = {
  party: [],
  collection: [
    'character_stats',
    'collection_npc',
    'collection_weapon',
    'collection_summon',
    'collection_artifact',
    'list_npc',
    'list_weapon',
    'list_summon'
  ],
  database: []
}

// ==========================================
// TIMING CONSTANTS
// ==========================================

export const TIMEOUTS = {
  statusMessage: 2000,
  loginSuccess: 1500,
  shakeAnimation: 600,
  scriptInitBase: 50,
  scriptInitMaxAttempts: 10
} as const
