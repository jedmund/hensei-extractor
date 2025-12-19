/**
 * @fileoverview Background service worker for the Granblue Fantasy Chrome extension.
 * Uses Chrome DevTools Debugger Protocol for network interception - completely
 * invisible to the page with no modified globals or injected scripts.
 *
 * IMPORTANT: This extension uses passive interception - it never makes
 * requests to GBF servers. All game data comes from intercepted responses.
 */

import { getApiUrl, getSiteBaseUrl, TIMEOUTS } from './constants.js'
import { initDebugger, isAttached, getAttachedTabs } from './debugger.js'

// ==========================================
// CACHE CONFIGURATION
// ==========================================

// Cache key prefixes for different data types
const CACHE_KEYS = {
  list_npc: 'gbf_cache_list_npc',
  list_weapon: 'gbf_cache_list_weapon',
  list_summon: 'gbf_cache_list_summon',
  collection_weapon: 'gbf_cache_collection_weapon',
  collection_npc: 'gbf_cache_collection_npc',
  collection_summon: 'gbf_cache_collection_summon',
  collection_artifact: 'gbf_cache_collection_artifact'
}

const PARTY_CACHE_PREFIX = 'gbf_cache_party_'
const DETAIL_NPC_CACHE_PREFIX = 'gbf_cache_detail_npc_'
const DETAIL_WEAPON_CACHE_PREFIX = 'gbf_cache_detail_weapon_'
const DETAIL_SUMMON_CACHE_PREFIX = 'gbf_cache_detail_summon_'
const CHARACTER_STATS_CACHE_KEY = 'gbf_cache_character_stats'

// How long cached data is considered fresh (30 minutes)
const CACHE_TTL_MS = 30 * 60 * 1000

// ==========================================
// INITIALIZATION
// ==========================================

// Initialize debugger interception
initDebugger(handleInterceptedData)

/**
 * Open side panel when extension icon is clicked
 */
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
})

// ==========================================
// DATA INTERCEPTION HANDLER
// ==========================================

/**
 * Handle data intercepted by the debugger
 * @param {string} url - The request URL
 * @param {Object} data - The JSON response data
 * @param {string} dataType - The detected data type
 * @param {Object} metadata - Additional metadata (pageNumber, partyId, masterId)
 * @param {number} timestamp - When the data was intercepted
 */
async function handleInterceptedData(url, data, dataType, metadata, timestamp) {
  if (!data || !dataType || dataType === 'unknown') {
    return
  }

  const { pageNumber, partyId, masterId } = metadata

  try {
    let actualDataType = dataType

    if (dataType === 'party' && partyId) {
      await cacheParty(partyId, data, timestamp, url)
      actualDataType = `party_${partyId}`
    } else if (dataType === 'character_detail' || dataType === 'zenith_npc') {
      await cacheCharacterStats(dataType, data, masterId, timestamp, url)
      actualDataType = 'character_stats'
    } else if (dataType.startsWith('list_') || dataType.startsWith('collection_')) {
      await cacheListPage(dataType, pageNumber, data, timestamp)
    } else if (dataType.startsWith('detail_')) {
      const result = await cacheDetailItem(dataType, data, timestamp, url)
      actualDataType = result.dataType
    } else {
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
    console.error('[Background] Error caching data:', error)
  }
}

// ==========================================
// CACHING FUNCTIONS
// ==========================================

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
 * Cache a database detail item with a per-item key
 */
async function cacheDetailItem(dataType, data, timestamp, url) {
  const granblueId = data.id || data.master?.id
  const name = data.name || data.master?.name || 'Unknown'

  let cacheKey
  if (dataType === 'detail_npc') {
    cacheKey = `${DETAIL_NPC_CACHE_PREFIX}${granblueId}`
  } else if (dataType === 'detail_weapon') {
    cacheKey = `${DETAIL_WEAPON_CACHE_PREFIX}${granblueId}`
  } else if (dataType === 'detail_summon') {
    cacheKey = `${DETAIL_SUMMON_CACHE_PREFIX}${granblueId}`
  } else {
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

  return { dataType: `${dataType}_${granblueId}` }
}

/**
 * Cache a party with its unique ID
 */
async function cacheParty(partyId, data, timestamp, url) {
  const cacheKey = PARTY_CACHE_PREFIX + partyId
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

  const result = await chrome.storage.local.get(cacheKey)
  const existing = result[cacheKey] || { pages: {}, lastUpdated: null }

  // Clear stale data
  if (existing.lastUpdated && (timestamp - existing.lastUpdated > CACHE_TTL_MS)) {
    existing.pages = {}
  }

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
 */
async function cacheCharacterStats(dataType, data, masterId, timestamp, url) {
  const result = await chrome.storage.local.get(CHARACTER_STATS_CACHE_KEY)
  const existing = result[CHARACTER_STATS_CACHE_KEY] || { lastUpdated: null, updates: {} }

  // Clear stale data
  if (existing.lastUpdated && (timestamp - existing.lastUpdated > CACHE_TTL_MS)) {
    existing.updates = {}
  }

  const resolvedMasterId = data?.master?.id || masterId
  if (!resolvedMasterId) {
    console.warn('[Background] No master_id found for character stats')
    return
  }

  const current = existing.updates[resolvedMasterId] || { masterId: resolvedMasterId }

  if (dataType === 'character_detail') {
    current.masterName = data?.master?.name || current.masterName
    current.timestamp = timestamp

    const element = data?.attribute || data?.element || data?.master?.attribute || data?.master?.element
    if (element) {
      current.element = element
    }

    if (data?.npc_arousal_form) {
      current.awakening = {
        type: data.npc_arousal_form,
        typeName: data.npc_arousal_form_text || getAwakeningTypeName(data.npc_arousal_form),
        level: data.npc_arousal_level || 1
      }
    }

    if (data?.has_npcaugment_constant !== undefined) {
      current.perpetuity = !!data.has_npcaugment_constant
    }
  } else if (dataType === 'zenith_npc') {
    current.timestamp = timestamp

    const masteryData = parseZenithMasteryData(data)

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

  existing.updates[resolvedMasterId] = current
  existing.lastUpdated = timestamp
  existing.characterCount = Object.keys(existing.updates).length

  await chrome.storage.local.set({ [CHARACTER_STATS_CACHE_KEY]: existing })
}

// ==========================================
// MASTERY DATA PARSING
// ==========================================

function getAwakeningTypeName(typeId) {
  const names = { 1: 'Attack', 2: 'Defense', 3: 'Multiattack', 4: 'Balanced' }
  return names[typeId] || 'Balanced'
}

const OVER_MASTERY_NAME_TO_ID = {
  'ATK': 1, 'HP': 2, 'Debuff Success': 3, 'Skill DMG Cap': 4,
  'C.A. DMG': 5, 'C.A. DMG Cap': 6, 'Stamina': 7, 'Enmity': 8,
  'Critical Hit': 9, 'Double Attack': 10, 'Double Attack Rate': 10,
  'Triple Attack': 11, 'Triple Attack Rate': 11, 'DEF': 12,
  'Healing': 13, 'Debuff Resistance': 14, 'Dodge': 15
}

const PERPETUITY_BONUS_NAME_TO_ID = {
  'EM Star Cap': 1, 'ATK': 2, 'HP': 3, 'DMG Cap': 4
}

const AETHERIAL_MASTERY_NAME_TO_ID = {
  'Double Attack': 1, 'Double Attack Rate': 1,
  'Triple Attack': 2, 'Triple Attack Rate': 2,
  'Fire ATK Up': 3, 'Water ATK Up': 3, 'Earth ATK Up': 3,
  'Wind ATK Up': 3, 'Light ATK Up': 3, 'Dark ATK Up': 3,
  'Fire Resistance': 4, 'Water Resistance': 4, 'Earth Resistance': 4,
  'Wind Resistance': 4, 'Light Resistance': 4, 'Dark Resistance': 4,
  'Stamina': 5, 'Enmity': 6, 'Supplemental DMG': 7,
  'Critical Hit': 8, 'Critical Hit Rate': 8,
  'Counters on Dodge': 9, 'Counters on DMG': 10
}

function parseDisplayValue(dispParam) {
  if (!dispParam) return 0
  const str = String(dispParam).replace(/^\+/, '')
  return parseInt(str, 10) || 0
}

function parseZenithMasteryData(data) {
  const result = { rings: [], earring: null, masterName: null, perpetuityBonuses: [] }

  if (data?.option?.character?.name) {
    result.masterName = data.option.character.name
  }

  const paramData = data?.option?.npcaugment?.param_data
  if (Array.isArray(paramData)) {
    for (const bonus of paramData) {
      if (!bonus || !bonus.type || !bonus.param) continue

      const typeName = bonus.type.name
      const slotNum = bonus.slot_number
      const strength = parseDisplayValue(bonus.param.disp_total_param)

      if (strength === 0) continue

      if (slotNum === 5) {
        const perpetuityId = PERPETUITY_BONUS_NAME_TO_ID[typeName]
        if (perpetuityId) {
          result.perpetuityBonuses.push({
            modifier: perpetuityId,
            strength: strength,
            typeName: typeName
          })
        }
        continue
      }

      if (slotNum === 4) {
        const modifierId = AETHERIAL_MASTERY_NAME_TO_ID[typeName]
        if (modifierId) {
          result.earring = {
            modifier: modifierId,
            strength: strength,
            typeName: typeName
          }
        }
        continue
      }

      const modifierId = OVER_MASTERY_NAME_TO_ID[typeName]
      if (modifierId) {
        result.rings.push({
          modifier: modifierId,
          strength: strength,
          typeName: typeName,
          slot: slotNum
        })
      }
    }
  }

  return result
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getCacheStatus':
      handleGetCacheStatus().then(sendResponse)
      return true

    case 'getCachedData':
      handleGetCachedData(message.dataType).then(sendResponse)
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

    case 'uploadPartyData':
      uploadPartyData(message.data).then(sendResponse)
      return true

    case 'uploadDetailData':
      uploadDetailData(message.data, message.dataType).then(sendResponse)
      return true

    case 'uploadCollectionData':
      uploadCollectionData(message.data, message.dataType, message.updateExisting).then(sendResponse)
      return true

    case 'uploadCharacterStats':
      uploadCharacterStats(message.data).then(sendResponse)
      return true

    case 'dataCaptured':
      // Forward to popup if it's listening
      chrome.runtime.sendMessage(message).catch(() => {})
      return false

    default:
      return false
  }
})

// ==========================================
// CACHE STATUS HANDLERS
// ==========================================

async function handleGetCachedData(dataType) {
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

  const timestamp = cached.timestamp || cached.lastUpdated
  const age = Date.now() - timestamp

  if (age > CACHE_TTL_MS) {
    return { error: 'Cached data is stale. Please refresh the page in-game.' }
  }

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

async function handleGetCacheStatus() {
  const allStorage = await chrome.storage.local.get(null)
  const status = {}
  const now = Date.now()

  // Add debugger status
  status._debugger = {
    attached: isAttached(),
    tabs: getAttachedTabs()
  }

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

  // Process party cache keys
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

  // Process database detail cache keys
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

async function handleClearCache(dataType) {
  if (dataType) {
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

// ==========================================
// DATA UPLOAD (to granblue.team only)
// ==========================================

async function uploadPartyData(data) {
  const auth = await getAuthToken()
  if (!auth) {
    return { error: 'Not logged in. Please log in first.' }
  }

  const apiUrl = await getApiUrl('/import')
  const siteUrl = await getSiteBaseUrl()

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.access_token}`
      },
      body: JSON.stringify({ import: data })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { error: `Upload failed (${response.status}): ${errorText}` }
    }

    const result = await response.json()
    return {
      success: true,
      shortcode: result.shortcode,
      url: `${siteUrl}/p/${result.shortcode}`
    }
  } catch (error) {
    return { error: `Upload failed: ${error.message}` }
  }
}

async function uploadDetailData(data, dataType) {
  const auth = await getAuthToken()
  if (!auth) {
    return { error: 'Not logged in. Please log in first.' }
  }

  const endpointMap = {
    'detail_npc': 'characters',
    'detail_weapon': 'weapons',
    'detail_summon': 'summons'
  }
  const endpoint = endpointMap[dataType]
  if (!endpoint) {
    return { error: `Unknown data type: ${dataType}` }
  }

  let lang = 'en'
  if (data.cjs && data.cjs.includes('_jp/')) {
    lang = 'jp'
  } else if (auth.language === 'ja') {
    lang = 'jp'
  }

  const apiUrl = await getApiUrl(`/import/${endpoint}?lang=${lang}`)

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.access_token}`
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { error: `Upload failed (${response.status}): ${errorText}` }
    }

    const result = await response.json()
    return { success: true, ...result }
  } catch (error) {
    return { error: `Upload failed: ${error.message}` }
  }
}

async function uploadCollectionData(pagesData, dataType, updateExisting = false) {
  const auth = await getAuthToken()
  if (!auth) {
    return { error: 'Not logged in. Please log in first.' }
  }

  const endpointMap = {
    'collection_weapon': 'weapons',
    'collection_npc': 'characters',
    'collection_summon': 'summons',
    'collection_artifact': 'artifacts',
    'list_weapon': 'weapons',
    'list_npc': 'characters',
    'list_summon': 'summons'
  }
  const endpoint = endpointMap[dataType]
  if (!endpoint) {
    return { error: `Unknown collection type: ${dataType}` }
  }

  const allItems = []
  for (const pageData of Object.values(pagesData)) {
    if (pageData && pageData.list && Array.isArray(pageData.list)) {
      allItems.push(...pageData.list)
    }
  }

  if (allItems.length === 0) {
    return { error: 'No items found in collection data' }
  }

  const apiUrl = await getApiUrl(`/collection/${endpoint}/import`)

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.access_token}`
      },
      body: JSON.stringify({
        data: { list: allItems },
        update_existing: updateExisting
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { error: `Upload failed (${response.status}): ${errorText}` }
    }

    const result = await response.json()
    return {
      success: result.success,
      created: result.created || 0,
      updated: result.updated || 0,
      skipped: result.skipped || 0,
      errors: result.errors || []
    }
  } catch (error) {
    return { error: `Upload failed: ${error.message}` }
  }
}

async function uploadCharacterStats(statsData) {
  const auth = await getAuthToken()
  if (!auth) {
    return { error: 'Not logged in. Please log in first.' }
  }

  const items = Object.values(statsData).map(char => {
    const item = { granblue_id: char.masterId }

    if (char.awakening) {
      item.awakening_type = char.awakening.type
      item.awakening_level = char.awakening.level
    }

    if (char.rings && char.rings.length > 0) {
      char.rings.forEach((ring, i) => {
        if (ring && ring.modifier) {
          item[`ring${i + 1}`] = {
            modifier: ring.modifier,
            strength: ring.strength
          }
        }
      })
    }

    if (char.earring && char.earring.modifier) {
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
    return { error: 'No character stats to import' }
  }

  const apiUrl = await getApiUrl('/collection/characters/import')

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.access_token}`
      },
      body: JSON.stringify({
        data: { list: items },
        update_existing: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { error: `Upload failed (${response.status}): ${errorText}` }
    }

    const result = await response.json()
    return {
      success: result.success,
      created: result.created || 0,
      updated: result.updated || 0,
      skipped: result.skipped || 0,
      errors: result.errors || []
    }
  } catch (error) {
    return { error: `Upload failed: ${error.message}` }
  }
}

async function getAuthToken() {
  const result = await chrome.storage.local.get('gbAuth')
  const auth = result.gbAuth

  if (!auth || !auth.access_token) {
    return null
  }

  if (auth.expires_at && Date.now() > auth.expires_at) {
    return null
  }

  return auth
}
