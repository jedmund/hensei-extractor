/**
 * @fileoverview Content script for the Granblue Fantasy Chrome extension.
 * This script listens for intercepted network responses from injector.js
 * and caches them for later export. It NEVER makes direct API calls to GBF servers.
 */

// ==========================================
// CONSTANTS
// ==========================================

// Cache key prefixes for different data types
const CACHE_KEYS = {
  list_npc: 'gbf_cache_list_npc',
  list_weapon: 'gbf_cache_list_weapon',
  list_summon: 'gbf_cache_list_summon',
  // Collection (inventory) pages
  collection_weapon: 'gbf_cache_collection_weapon',
  collection_npc: 'gbf_cache_collection_npc',
  collection_summon: 'gbf_cache_collection_summon',
  collection_artifact: 'gbf_cache_collection_artifact'
}

// Party cache key prefix (parties are stored as gbf_cache_party_{group}_{slot})
const PARTY_CACHE_PREFIX = 'gbf_cache_party_'

// Database detail cache key prefixes (per-item, like parties)
const DETAIL_NPC_CACHE_PREFIX = 'gbf_cache_detail_npc_'
const DETAIL_WEAPON_CACHE_PREFIX = 'gbf_cache_detail_weapon_'
const DETAIL_SUMMON_CACHE_PREFIX = 'gbf_cache_detail_summon_'

// Character stats cache key (accumulates awakening + mastery data from multiple characters)
const CHARACTER_STATS_CACHE_KEY = 'gbf_cache_character_stats'

// How long cached data is considered fresh (30 minutes)
const CACHE_TTL_MS = 30 * 60 * 1000

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Entry point: Sets up the content script
 */
function init() {
  // Listen for intercepted data from injector.js (runs in MAIN world)
  window.addEventListener('gbf-data-intercepted', handleInterceptedData)

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleMessages)
}

// ==========================================
// DATA INTERCEPTION HANDLER
// ==========================================

/**
 * Handles data intercepted by injector.js
 * @param {CustomEvent} event - The custom event with intercepted data
 */
async function handleInterceptedData(event) {
  const { url, data, dataType, pageNumber, partyId, masterId, timestamp } = event.detail

  if (!data || !dataType) {
    return
  }

  try {
    let actualDataType = dataType

    if (dataType === 'party' && partyId) {
      // Store party with its unique ID
      await cacheParty(partyId, data, timestamp, url)
      actualDataType = `party_${partyId}`
    } else if (dataType === 'character_detail' || dataType === 'zenith_npc') {
      // Character stats data - accumulate by master_id
      await cacheCharacterStats(dataType, data, masterId, timestamp, url)
      actualDataType = 'character_stats'
    } else if (dataType.startsWith('list_') || dataType.startsWith('collection_')) {
      // For list/collection data, accumulate pages
      await cacheListPage(dataType, pageNumber, data, timestamp)
    } else if (dataType.startsWith('detail_')) {
      // For database detail items, store per-item (like parties)
      const result = await cacheDetailItem(dataType, data, timestamp, url)
      actualDataType = result.dataType
    } else {
      // Other single items
      await cacheSingleItem(dataType, data, timestamp, url)
    }

    // Notify popup that new data is available
    chrome.runtime.sendMessage({
      action: 'dataCaptured',
      dataType: actualDataType,
      pageNumber: pageNumber,
      timestamp: timestamp
    }).catch(() => {
      // Popup might not be open, ignore
    })
  } catch (error) {
    console.error('[GBF Extractor] Error caching data:', error)
  }
}

/**
 * Cache a single item (non-detail, non-party)
 */
async function cacheSingleItem(dataType, data, timestamp, url) {
  const cacheKey = CACHE_KEYS[dataType]
  if (!cacheKey) return

  await chrome.storage.local.set({
    [cacheKey]: {
      data: data,
      timestamp: timestamp,
      url: url
    }
  })
}

/**
 * Cache a database detail item with a per-item key (like parties)
 */
async function cacheDetailItem(dataType, data, timestamp, url) {
  const granblueId = data.id || data.master?.id
  const name = data.name || data.master?.name || 'Unknown'

  // Determine cache key prefix based on type
  let cacheKey
  if (dataType === 'detail_npc') {
    cacheKey = `${DETAIL_NPC_CACHE_PREFIX}${granblueId}`
  } else if (dataType === 'detail_weapon') {
    cacheKey = `${DETAIL_WEAPON_CACHE_PREFIX}${granblueId}`
  } else if (dataType === 'detail_summon') {
    cacheKey = `${DETAIL_SUMMON_CACHE_PREFIX}${granblueId}`
  } else {
    // Unknown detail type, fall back to standard caching
    await cacheSingleItem(dataType, data, timestamp, url)
    return { dataType }
  }

  await chrome.storage.local.set({
    [cacheKey]: {
      data: data,
      timestamp: timestamp,
      url: url,
      granblueId: granblueId,
      itemName: name
    }
  })

  // Return the item-specific dataType for notification
  return { dataType: `${dataType}_${granblueId}` }
}

/**
 * Cache a party with its unique ID
 */
async function cacheParty(partyId, data, timestamp, url) {
  const cacheKey = PARTY_CACHE_PREFIX + partyId

  // Extract party name from data for display
  const partyName = data.deck?.name || `Party ${partyId.replace('_', '-')}`

  await chrome.storage.local.set({
    [cacheKey]: {
      data: data,
      timestamp: timestamp,
      url: url,
      partyId: partyId,
      partyName: partyName
    }
  })
}

/**
 * Cache a page of list data, accumulating with existing pages
 */
async function cacheListPage(dataType, pageNumber, data, timestamp) {
  const cacheKey = CACHE_KEYS[dataType]
  if (!cacheKey) return

  // Get existing cache
  const result = await chrome.storage.local.get(cacheKey)
  const existing = result[cacheKey] || { pages: {}, lastUpdated: null }

  // Check if existing data is stale (older than TTL)
  if (existing.lastUpdated && (timestamp - existing.lastUpdated > CACHE_TTL_MS)) {
    // Clear stale data
    existing.pages = {}
  }

  // Add/update this page
  existing.pages[pageNumber] = data
  existing.lastUpdated = timestamp

  // Calculate total items
  let totalItems = 0
  for (const page of Object.values(existing.pages)) {
    if (page.list && Array.isArray(page.list)) {
      totalItems += page.list.length
    }
  }
  existing.totalItems = totalItems
  existing.pageCount = Object.keys(existing.pages).length

  await chrome.storage.local.set({ [cacheKey]: existing })
}

/**
 * Cache character stats data (awakening + mastery bonuses)
 * Merges data from character_detail and zenith_npc pages by master_id
 */
async function cacheCharacterStats(dataType, data, masterId, timestamp, url) {
  // Get existing cache
  const result = await chrome.storage.local.get(CHARACTER_STATS_CACHE_KEY)
  const existing = result[CHARACTER_STATS_CACHE_KEY] || { lastUpdated: null, updates: {} }

  // Check if existing data is stale (older than TTL) - if so, clear it
  if (existing.lastUpdated && (timestamp - existing.lastUpdated > CACHE_TTL_MS)) {
    existing.updates = {}
  }

  // Extract master_id - try from data first, then from passed value
  const resolvedMasterId = data?.master?.id || masterId
  if (!resolvedMasterId) {
    console.warn('[GBF Extractor] No master_id found for character stats')
    return
  }

  // Get or create entry for this character
  const current = existing.updates[resolvedMasterId] || {
    masterId: resolvedMasterId
  }

  if (dataType === 'character_detail') {
    // Extract awakening data from character detail page
    current.masterName = data?.master?.name || current.masterName
    current.timestamp = timestamp

    // Element (attribute)
    const element = data?.attribute || data?.element || data?.master?.attribute || data?.master?.element
    if (element) {
      current.element = element
    }

    // Only set awakening if data is present
    if (data?.npc_arousal_form) {
      current.awakening = {
        type: data.npc_arousal_form,
        typeName: data.npc_arousal_form_text || getAwakeningTypeName(data.npc_arousal_form),
        level: data.npc_arousal_level || 1
      }
    }

    // Perpetuity ring status
    if (data?.has_npcaugment_constant !== undefined) {
      current.perpetuity = !!data.has_npcaugment_constant
    }
  } else if (dataType === 'zenith_npc') {
    // Extract mastery bonus data from zenith page
    current.timestamp = timestamp

    // Parse over mastery (rings) and aetherial mastery (earring) from zenith data
    const masteryData = parseZenithMasteryData(data)

    // Use character name from zenith data if we don't have it yet
    if (masteryData.masterName && !current.masterName) {
      current.masterName = masteryData.masterName
    }

    if (masteryData.rings && masteryData.rings.length > 0) {
      current.rings = masteryData.rings
    }
    if (masteryData.earring) {
      current.earring = masteryData.earring
    }
    if (masteryData.perpetuityBonuses && masteryData.perpetuityBonuses.length > 0) {
      current.perpetuityBonuses = masteryData.perpetuityBonuses
    }
  }

  // Save back to cache
  existing.updates[resolvedMasterId] = current
  existing.lastUpdated = timestamp
  existing.characterCount = Object.keys(existing.updates).length

  await chrome.storage.local.set({ [CHARACTER_STATS_CACHE_KEY]: existing })
}

/**
 * Get character awakening type name from type ID
 * Characters have 4 awakening types: Attack, Multiattack, Defense, Balanced
 */
function getAwakeningTypeName(typeId) {
  const names = {
    1: 'Attack',
    2: 'Defense',
    3: 'Multiattack',
    4: 'Balanced'
  }
  return names[typeId] || 'Balanced'
}

/**
 * GBF stat name → hensei modifier ID for Over Mastery (rings)
 * Names match exactly what GBF returns in the API
 */
const OVER_MASTERY_NAME_TO_ID = {
  'ATK': 1,
  'HP': 2,
  'Debuff Success': 3,
  'Skill DMG Cap': 4,
  'C.A. DMG': 5,
  'C.A. DMG Cap': 6,
  'Stamina': 7,
  'Enmity': 8,
  'Critical Hit': 9,
  'Double Attack': 10,
  'Double Attack Rate': 10,
  'Triple Attack': 11,
  'Triple Attack Rate': 11,
  'DEF': 12,
  'Healing': 13,
  'Debuff Resistance': 14,
  'Dodge': 15
}

/**
 * GBF stat name → ID for Perpetuity Ring bonuses (slot 5)
 */
const PERPETUITY_BONUS_NAME_TO_ID = {
  'EM Star Cap': 1,
  'ATK': 2,
  'HP': 3,
  'DMG Cap': 4
}

/**
 * GBF stat name → hensei modifier ID for Aetherial Mastery (earring)
 * Names match exactly what GBF returns in the API
 * Element-based stats show as "Fire ATK Up", "Water Resistance", etc.
 */
const AETHERIAL_MASTERY_NAME_TO_ID = {
  'Double Attack': 1,
  'Double Attack Rate': 1,
  'Triple Attack': 2,
  'Triple Attack Rate': 2,
  // Element ATK - each element has its own name
  'Fire ATK Up': 3,
  'Water ATK Up': 3,
  'Earth ATK Up': 3,
  'Wind ATK Up': 3,
  'Light ATK Up': 3,
  'Dark ATK Up': 3,
  // Element Resistance - each element has its own name
  'Fire Resistance': 4,
  'Water Resistance': 4,
  'Earth Resistance': 4,
  'Wind Resistance': 4,
  'Light Resistance': 4,
  'Dark Resistance': 4,
  'Stamina': 5,
  'Enmity': 6,
  'Supplemental DMG': 7,
  'Critical Hit': 8,
  'Critical Hit Rate': 8,
  'Counters on Dodge': 9,
  'Counters on DMG': 10
}

/**
 * Parse mastery bonus data from zenith page response
 * The zenith page returns data in option.npcaugment.param_data structure
 * Each entry has: type.name, type.id, param.total_param, param.disp_total_param, slot_number
 *
 * Slot structure:
 * - Slot 1: Ring 1 (ATK + HP together via split_key)
 * - Slot 2: Ring 2 (single stat)
 * - Slot 3: Ring 3 (single stat)
 * - Slot 4: Aetherial Mastery (earring)
 * - Slot 5: Perpetuity Ring bonuses
 */
/**
 * Parse display value from disp_total_param (e.g., "+10" -> 10, "+1500" -> 1500)
 */
function parseDisplayValue(dispParam) {
  if (!dispParam) return 0
  // Strip "+" prefix and parse as number
  const str = String(dispParam).replace(/^\+/, '')
  return parseInt(str, 10) || 0
}

function parseZenithMasteryData(data) {
  const result = { rings: [], earring: null, masterName: null, perpetuityBonuses: [] }

  // Try to get character name from zenith data
  if (data?.option?.character?.name) {
    result.masterName = data.option.character.name
  }

  // All mastery bonuses are in option.npcaugment.param_data
  const paramData = data?.option?.npcaugment?.param_data
  if (Array.isArray(paramData)) {
    for (const bonus of paramData) {
      if (!bonus || !bonus.type || !bonus.param) continue

      const typeName = bonus.type.name
      const slotNum = bonus.slot_number
      // Use disp_total_param for display value (e.g., "+10", "+1500")
      const strength = parseDisplayValue(bonus.param.disp_total_param)

      // Skip if no actual bonus value
      if (strength === 0) continue

      // Slot 5: Perpetuity Ring bonuses
      if (slotNum === 5) {
        const perpetuityId = PERPETUITY_BONUS_NAME_TO_ID[typeName]
        if (perpetuityId) {
          result.perpetuityBonuses.push({
            modifier: perpetuityId,
            strength: strength,
            typeName: typeName
          })
        } else {
          console.warn(`[GBF Extractor] Unknown Perpetuity bonus type: ${typeName}`)
        }
        continue
      }

      // Slot 4: Aetherial Mastery (earring)
      if (slotNum === 4) {
        const modifierId = AETHERIAL_MASTERY_NAME_TO_ID[typeName]
        if (modifierId) {
          result.earring = {
            modifier: modifierId,
            strength: strength,
            typeName: typeName
          }
        } else {
          console.warn(`[GBF Extractor] Unknown Aetherial Mastery type: ${typeName}`)
        }
        continue
      }

      // Slots 1-3: Over Mastery (rings)
      const modifierId = OVER_MASTERY_NAME_TO_ID[typeName]
      if (!modifierId) {
        console.warn(`[GBF Extractor] Unknown Over Mastery type: ${typeName}`)
        continue
      }

      result.rings.push({
        modifier: modifierId,
        strength: strength,
        typeName: typeName,
        slot: slotNum
      })
    }
  }

  return result
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

/**
 * Handles incoming messages from popup or background script
 */
function handleMessages(message, sender, sendResponse) {
  if (message.action === 'ping') {
    sendResponse({ status: 'ok' })
    return true
  }

  if (message.action === 'getCachedData') {
    handleGetCachedData(message.dataType).then(sendResponse)
    return true // Will respond asynchronously
  }

  if (message.action === 'getCacheStatus') {
    handleGetCacheStatus().then(sendResponse)
    return true
  }

  if (message.action === 'clearCache') {
    handleClearCache(message.dataType).then(sendResponse)
    return true
  }

  return false
}

/**
 * Get cached data for a specific type
 */
async function handleGetCachedData(dataType) {
  // Handle character_stats specially
  if (dataType === 'character_stats') {
    const result = await chrome.storage.local.get(CHARACTER_STATS_CACHE_KEY)
    const cached = result[CHARACTER_STATS_CACHE_KEY]

    if (!cached || Object.keys(cached.updates || {}).length === 0) {
      return { error: 'No character stats captured. Browse character detail or zenith pages in-game.' }
    }

    const age = Date.now() - cached.lastUpdated

    if (age > CACHE_TTL_MS) {
      return { error: 'Cached data is stale. Please browse character pages again in-game.' }
    }

    return {
      data: cached.updates,
      timestamp: cached.lastUpdated,
      age: age,
      dataType: dataType,
      characterCount: cached.characterCount || Object.keys(cached.updates).length
    }
  }

  // Handle party data types (party_1_2 format)
  let cacheKey
  if (dataType.startsWith('party_')) {
    const partyId = dataType.replace('party_', '')
    cacheKey = PARTY_CACHE_PREFIX + partyId
  } else if (dataType.startsWith('detail_npc_')) {
    const granblueId = dataType.replace('detail_npc_', '')
    cacheKey = DETAIL_NPC_CACHE_PREFIX + granblueId
  } else if (dataType.startsWith('detail_weapon_')) {
    const granblueId = dataType.replace('detail_weapon_', '')
    cacheKey = DETAIL_WEAPON_CACHE_PREFIX + granblueId
  } else if (dataType.startsWith('detail_summon_')) {
    const granblueId = dataType.replace('detail_summon_', '')
    cacheKey = DETAIL_SUMMON_CACHE_PREFIX + granblueId
  } else {
    cacheKey = CACHE_KEYS[dataType]
  }

  if (!cacheKey) {
    return { error: `Unknown data type: ${dataType}` }
  }

  const result = await chrome.storage.local.get(cacheKey)
  const cached = result[cacheKey]

  if (!cached) {
    return { error: 'No cached data available. Browse to the relevant page in-game to capture data.' }
  }

  // Check freshness
  const timestamp = cached.timestamp || cached.lastUpdated
  const age = Date.now() - timestamp

  if (age > CACHE_TTL_MS) {
    return { error: 'Cached data is stale. Please refresh the page in-game.' }
  }

  // For list/collection data, return combined data
  if (dataType.startsWith('list_') || dataType.startsWith('collection_')) {
    return {
      data: cached.pages,
      timestamp: cached.lastUpdated,
      age: age,
      dataType: dataType,
      pageCount: cached.pageCount,
      totalItems: cached.totalItems
    }
  }

  return {
    data: cached.data,
    timestamp: cached.timestamp,
    age: age,
    dataType: dataType
  }
}

/**
 * Get status of all cached data
 */
async function handleGetCacheStatus() {
  // Get all storage to find party keys dynamically
  const allStorage = await chrome.storage.local.get(null)

  const status = {}
  const now = Date.now()

  // Process standard cache keys
  for (const [type, key] of Object.entries(CACHE_KEYS)) {
    const cached = allStorage[key]
    if (cached) {
      const timestamp = cached.timestamp || cached.lastUpdated
      const age = now - timestamp
      const isStale = age > CACHE_TTL_MS

      if (type.startsWith('list_') || type.startsWith('collection_')) {
        status[type] = {
          available: !isStale && cached.pageCount > 0,
          pageCount: cached.pageCount || 0,
          totalItems: cached.totalItems || 0,
          lastUpdated: timestamp,
          age: age,
          isStale: isStale
        }
      } else {
        status[type] = {
          available: !isStale,
          lastUpdated: timestamp,
          age: age,
          isStale: isStale
        }
      }
    } else {
      status[type] = { available: false }
    }
  }

  // Process party cache keys (gbf_cache_party_*)
  for (const [key, cached] of Object.entries(allStorage)) {
    if (key.startsWith(PARTY_CACHE_PREFIX) && cached) {
      const partyId = key.replace(PARTY_CACHE_PREFIX, '')
      const dataType = `party_${partyId}`
      const timestamp = cached.timestamp
      const age = now - timestamp
      const isStale = age > CACHE_TTL_MS

      status[dataType] = {
        available: !isStale,
        lastUpdated: timestamp,
        age: age,
        isStale: isStale,
        partyId: partyId,
        partyName: cached.partyName || `Party ${partyId.replace('_', '-')}`
      }
    }
  }

  // Process database detail cache keys (per-item, like parties)
  for (const [key, cached] of Object.entries(allStorage)) {
    let dataType = null
    let granblueId = null

    if (key.startsWith(DETAIL_NPC_CACHE_PREFIX)) {
      granblueId = key.replace(DETAIL_NPC_CACHE_PREFIX, '')
      dataType = `detail_npc_${granblueId}`
    } else if (key.startsWith(DETAIL_WEAPON_CACHE_PREFIX)) {
      granblueId = key.replace(DETAIL_WEAPON_CACHE_PREFIX, '')
      dataType = `detail_weapon_${granblueId}`
    } else if (key.startsWith(DETAIL_SUMMON_CACHE_PREFIX)) {
      granblueId = key.replace(DETAIL_SUMMON_CACHE_PREFIX, '')
      dataType = `detail_summon_${granblueId}`
    }

    if (dataType && cached) {
      const timestamp = cached.timestamp
      const age = now - timestamp
      const isStale = age > CACHE_TTL_MS

      status[dataType] = {
        available: !isStale,
        lastUpdated: timestamp,
        age: age,
        isStale: isStale,
        granblueId: granblueId,
        itemName: cached.itemName || 'Unknown'
      }
    }
  }

  // Process character stats cache
  const charStatsCache = allStorage[CHARACTER_STATS_CACHE_KEY]
  if (charStatsCache && charStatsCache.updates) {
    const characterCount = Object.keys(charStatsCache.updates).length
    if (characterCount > 0) {
      const timestamp = charStatsCache.lastUpdated
      const age = now - timestamp
      const isStale = age > CACHE_TTL_MS

      status['character_stats'] = {
        available: !isStale,
        lastUpdated: timestamp,
        age: age,
        isStale: isStale,
        characterCount: characterCount
      }
    }
  }

  return status
}

/**
 * Clear cached data
 */
async function handleClearCache(dataType) {
  if (dataType) {
    // Handle party data types
    if (dataType.startsWith('party_')) {
      const partyId = dataType.replace('party_', '')
      await chrome.storage.local.remove(PARTY_CACHE_PREFIX + partyId)
    } else if (dataType.startsWith('detail_npc_')) {
      const granblueId = dataType.replace('detail_npc_', '')
      await chrome.storage.local.remove(DETAIL_NPC_CACHE_PREFIX + granblueId)
    } else if (dataType.startsWith('detail_weapon_')) {
      const granblueId = dataType.replace('detail_weapon_', '')
      await chrome.storage.local.remove(DETAIL_WEAPON_CACHE_PREFIX + granblueId)
    } else if (dataType.startsWith('detail_summon_')) {
      const granblueId = dataType.replace('detail_summon_', '')
      await chrome.storage.local.remove(DETAIL_SUMMON_CACHE_PREFIX + granblueId)
    } else if (dataType === 'character_stats') {
      await chrome.storage.local.remove(CHARACTER_STATS_CACHE_KEY)
    } else {
      const cacheKey = CACHE_KEYS[dataType]
      if (cacheKey) {
        await chrome.storage.local.remove(cacheKey)
      }
    }
  } else {
    // Clear all cache including parties, per-item details, and character stats
    const allStorage = await chrome.storage.local.get(null)
    const keysToRemove = [
      ...Object.values(CACHE_KEYS),
      CHARACTER_STATS_CACHE_KEY,
      ...Object.keys(allStorage).filter(key =>
        key.startsWith(PARTY_CACHE_PREFIX) ||
        key.startsWith(DETAIL_NPC_CACHE_PREFIX) ||
        key.startsWith(DETAIL_WEAPON_CACHE_PREFIX) ||
        key.startsWith(DETAIL_SUMMON_CACHE_PREFIX)
      )
    ]
    await chrome.storage.local.remove(keysToRemove)
  }
  return { success: true }
}

// Start the content script
init()
