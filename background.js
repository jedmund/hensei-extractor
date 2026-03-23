/**
 * @fileoverview Background service worker for the Granblue Fantasy Chrome extension.
 * Uses Chrome DevTools Debugger Protocol for network interception - completely
 * invisible to the page with no modified globals or injected scripts.
 *
 * IMPORTANT: This extension uses passive interception - it never makes
 * requests to GBF servers. All game data comes from intercepted responses.
 */

import {
  getApiUrl, getSiteBaseUrl, TIMEOUTS,
  CACHE_KEYS, CACHE_PREFIXES, CACHE_TTL_MS, RAID_GROUPS_CACHE_TTL_MS, resolveCacheKey
} from './constants.js'
import { initDebugger, isAttached, getAttachedTabs } from './debugger.js'
import {
  OVER_MASTERY_NAME_TO_ID, PERPETUITY_BONUS_NAME_TO_ID,
  AETHERIAL_MASTERY_NAME_TO_ID, parseDisplayValue
} from './mastery.js'

// ==========================================
// INITIALIZATION
// ==========================================

// Initialize debugger interception
initDebugger(handleInterceptedData)

// In-memory cache for collection ownership IDs
let collectionIdsCache = null
let collectionIdsCacheTime = 0
const COLLECTION_IDS_TTL_MS = 5 * 60 * 1000

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
    } else if (dataType.startsWith('stash_')) {
      const stashNum = metadata.stashNumber || '1'
      const prefix = CACHE_PREFIXES[dataType]
      await cacheListPage(dataType, pageNumber, data, timestamp, prefix + stashNum)
      actualDataType = `${dataType}_${stashNum}`
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

  const prefix = CACHE_PREFIXES[dataType]
  if (!prefix) {
    await cacheSingleItem(dataType, data, timestamp, url)
    return { dataType }
  }
  const cacheKey = `${prefix}${granblueId}`

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
  const cacheKey = CACHE_PREFIXES.party + partyId
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
async function cacheListPage(dataType, pageNumber, data, timestamp, cacheKeyOverride) {
  const cacheKey = cacheKeyOverride || CACHE_KEYS[dataType]
  if (!cacheKey) return

  const result = await chrome.storage.local.get(cacheKey)
  const existing = result[cacheKey] || { pages: {}, lastUpdated: null }

  // Clear stale data
  if (existing.lastUpdated && (timestamp - existing.lastUpdated > CACHE_TTL_MS)) {
    existing.pages = {}
  }

  existing.pages[pageNumber] = data
  existing.lastUpdated = timestamp

  // Extract total pages from game response if available
  // Game responses include option.total_page for paginated lists
  if (data.option?.total_page) {
    existing.totalPages = data.option.total_page
  }

  // Calculate total items
  let totalItems = 0
  for (const page of Object.values(existing.pages)) {
    if (page.list && Array.isArray(page.list)) {
      totalItems += page.list.length
    }
  }
  existing.totalItems = totalItems
  existing.pageCount = Object.keys(existing.pages).length

  // Track if we have captured all pages (for full sync functionality)
  existing.isComplete = existing.totalPages
    ? existing.pageCount >= existing.totalPages
    : false

  await chrome.storage.local.set({ [cacheKey]: existing })
}

/**
 * Cache character stats data (awakening + mastery bonuses)
 */
async function cacheCharacterStats(dataType, data, masterId, timestamp, url) {
  const result = await chrome.storage.local.get(CACHE_KEYS.character_stats)
  const existing = result[CACHE_KEYS.character_stats] || { lastUpdated: null, updates: {} }

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

  await chrome.storage.local.set({ [CACHE_KEYS.character_stats]: existing })
}

// ==========================================
// MASTERY DATA PARSING
// ==========================================

function getAwakeningTypeName(typeId) {
  const names = { 1: 'Balanced', 2: 'Attack', 3: 'Defense', 4: 'Multiattack' }
  return names[typeId] || 'Balanced'
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
// VERSION CHECK
// ==========================================

async function checkExtensionVersion() {
  try {
    const apiUrl = await getApiUrl('/version')
    const response = await fetch(apiUrl)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.extension?.version) return null

    const current = chrome.runtime.getManifest().version
    const latest = data.extension.version

    const isOutdated = compareVersions(current, latest) < 0
    return { isOutdated, current, latest }
  } catch {
    return null
  }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'checkExtensionVersion':
      checkExtensionVersion().then(sendResponse)
      return true

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

    case 'fetchRaidGroups':
      fetchRaidGroups(message.forceRefresh).then(sendResponse)
      return true

    case 'fetchUserPlaylists':
      fetchUserPlaylists().then(sendResponse)
      return true

    case 'createPlaylist':
      createPlaylist(message.data).then(sendResponse)
      return true

    case 'uploadPartyData':
      uploadPartyData(message.data, message.raidId, message.playlistIds, message.name).then(sendResponse)
      return true

    case 'uploadDetailData':
      uploadDetailData(message.data, message.dataType).then(sendResponse)
      return true

    case 'getCollectionIds':
      getCollectionIds().then(sendResponse)
      return true

    case 'checkConflicts':
      checkConflicts(message.data, message.dataType).then(sendResponse)
      return true

    case 'uploadCollectionData':
      uploadCollectionData(message.data, message.dataType, {
        updateExisting: message.updateExisting,
        isFullInventory: message.isFullInventory,
        reconcileDeletions: message.reconcileDeletions,
        conflictResolutions: message.conflictResolutions
      }).then(sendResponse)
      return true

    case 'previewSyncDeletions':
      previewSyncDeletions(message.data, message.dataType).then(sendResponse)
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
    const result = await chrome.storage.local.get(CACHE_KEYS.character_stats)
    const cached = result[CACHE_KEYS.character_stats]

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

  const cacheKey = resolveCacheKey(dataType)
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

  if (dataType.startsWith('list_') || dataType.startsWith('collection_') || dataType.startsWith('stash_')) {
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

  // Process standard (static) cache keys
  for (const [type, key] of Object.entries(CACHE_KEYS)) {
    const cached = allStorage[key]
    if (!cached) {
      status[type] = { available: false }
      continue
    }

    const timestamp = cached.timestamp || cached.lastUpdated
    const age = now - timestamp
    const stale = age > CACHE_TTL_MS

    if (type === 'character_stats') {
      const characterCount = Object.keys(cached.updates || {}).length
      if (characterCount > 0) {
        status[type] = { available: !stale, lastUpdated: timestamp, age, isStale: stale, characterCount }
      }
    } else if (type.startsWith('list_') || type.startsWith('collection_')) {
      status[type] = {
        available: !stale && cached.pageCount > 0,
        pageCount: cached.pageCount || 0,
        totalPages: cached.totalPages || null,
        totalItems: cached.totalItems || 0,
        lastUpdated: timestamp, age, isStale: stale,
        isComplete: cached.isComplete || false
      }
    } else {
      status[type] = { available: !stale, lastUpdated: timestamp, age, isStale: stale }
    }
  }

  // Process dynamic cache keys (parties, stashes, detail items)
  for (const [key, cached] of Object.entries(allStorage)) {
    if (!cached) continue

    // Find which prefix this key belongs to
    let matchedPrefix = null
    let suffix = null
    for (const [prefixName, cachePrefix] of Object.entries(CACHE_PREFIXES)) {
      if (key.startsWith(cachePrefix)) {
        matchedPrefix = prefixName
        suffix = key.slice(cachePrefix.length)
        break
      }
    }
    if (!matchedPrefix) continue

    const dataType = `${matchedPrefix}_${suffix}`
    const timestamp = cached.timestamp || cached.lastUpdated
    const age = now - timestamp
    const stale = age > CACHE_TTL_MS

    if (matchedPrefix === 'party') {
      status[dataType] = {
        available: !stale, lastUpdated: timestamp, age, isStale: stale,
        partyId: suffix,
        partyName: cached.partyName || `Party ${suffix.replace('_', '-')}`
      }
    } else if (matchedPrefix.startsWith('stash_')) {
      status[dataType] = {
        available: !stale && cached.pageCount > 0,
        pageCount: cached.pageCount || 0,
        totalItems: cached.totalItems || 0,
        lastUpdated: timestamp, age, isStale: stale
      }
    } else if (matchedPrefix.startsWith('detail_')) {
      status[dataType] = {
        available: !stale, lastUpdated: timestamp, age, isStale: stale,
        granblueId: suffix,
        itemName: cached.itemName || 'Unknown'
      }
    }
  }

  return status
}

async function handleClearCache(dataType) {
  if (dataType) {
    const cacheKey = resolveCacheKey(dataType)
    if (cacheKey) {
      await chrome.storage.local.remove(cacheKey)
    }
  } else {
    // Clear all cache keys (static + dynamic)
    const allStorage = await chrome.storage.local.get(null)
    const prefixValues = Object.values(CACHE_PREFIXES)
    const keysToRemove = [
      ...Object.values(CACHE_KEYS),
      ...Object.keys(allStorage).filter(key =>
        prefixValues.some(prefix => key.startsWith(prefix))
      )
    ]
    await chrome.storage.local.remove(keysToRemove)
  }
  return { success: true }
}

// ==========================================
// DATA UPLOAD (to granblue.team only)
// ==========================================

/**
 * Collect all items from paginated data into a flat array
 */
function collectPageItems(pagesData) {
  const items = []
  for (const pageData of Object.values(pagesData)) {
    if (pageData?.list && Array.isArray(pageData.list)) {
      items.push(...pageData.list)
    }
  }
  return items
}

/** Data type to API endpoint mapping */
const ENDPOINT_MAP = {
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

function resolveEndpoint(dataType) {
  if (ENDPOINT_MAP[dataType]) return ENDPOINT_MAP[dataType]
  if (dataType.startsWith('stash_weapon')) return 'weapons'
  if (dataType.startsWith('stash_summon')) return 'summons'
  return null
}

/**
 * Parse an error response into a user-friendly message.
 */
async function parseErrorResponse(response) {
  const text = await response.text()
  try {
    const json = JSON.parse(text)
    if (json.error) return json.error
  } catch { /* not JSON */ }
  return text || `Request failed (${response.status})`
}

/**
 * Make an authenticated POST request to the API.
 * @returns {{ error?: string, data?: any, auth?: Object }}
 */
async function authenticatedPost(endpoint, body) {
  const auth = await getAuthToken()
  if (!auth) return { error: 'Not logged in. Please log in first.' }

  const apiUrl = await getApiUrl(endpoint)
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.access_token}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      return { error: await parseErrorResponse(response) }
    }

    return { data: await response.json(), auth }
  } catch (error) {
    return { error: `Request failed: ${error.message}` }
  }
}

async function uploadPartyData(data, raidId, playlistIds, name) {
  const body = { import: data }
  if (raidId) body.raid_id = raidId
  if (playlistIds?.length > 0) body.playlist_ids = playlistIds
  if (name) body.name = name

  const result = await authenticatedPost('/import', body)
  if (result.error) return result

  const siteUrl = await getSiteBaseUrl()
  return {
    success: true,
    shortcode: result.data.shortcode,
    url: `${siteUrl}/teams/${result.data.shortcode}`
  }
}

async function uploadDetailData(data, dataType) {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: `Unknown data type: ${dataType}` }

  const auth = await getAuthToken()
  let lang = 'en'
  if (data.cjs && data.cjs.includes('_jp/')) {
    lang = 'jp'
  } else if (auth?.language === 'ja') {
    lang = 'jp'
  }

  const result = await authenticatedPost(`/import/${endpoint}?lang=${lang}`, data)
  if (result.error) return result
  return { success: true, ...result.data }
}

/**
 * Parse game filter options to extract active element/proficiency filters
 * Filter field "6" = element (6 chars: Fire, Water, Earth, Wind, Light, Dark)
 * Filter field "8" = proficiency (10 chars for weapon types)
 * A "1" in position means that value is selected, "0" means not selected
 * If all zeros or value is 0/null, means "all" (no filter)
 */
function parseGameFilter(options) {
  const filter = options?.filter
  if (!filter) return null

  const result = { elements: null, proficiencies: null }

  // Parse element filter (field "6")
  // Positions: 0=Fire, 1=Water, 2=Earth, 3=Wind, 4=Light, 5=Dark
  // Maps to Granblue element IDs: Fire=1, Water=2, Earth=3, Wind=4, Light=5, Dark=6
  const elementStr = filter['6']
  if (elementStr && typeof elementStr === 'string' && elementStr !== '000000') {
    result.elements = []
    for (let i = 0; i < elementStr.length; i++) {
      if (elementStr[i] === '1') {
        // Position maps to element ID (position + 1, but reordered)
        // GBF filter order: Fire(0), Water(1), Earth(2), Wind(3), Light(4), Dark(5)
        // GBF element IDs: Fire=2, Water=3, Earth=4, Wind=1, Light=6, Dark=5
        const elementMap = [2, 3, 4, 1, 6, 5] // filter position -> element ID
        result.elements.push(elementMap[i])
      }
    }
    if (result.elements.length === 0) result.elements = null
  }

  // Parse proficiency filter (field "8")
  // Positions: 0=Saber, 1=Dagger, 2=Spear, 3=Axe, 4=Staff, 5=Gun, 6=Melee, 7=Bow, 8=Harp, 9=Katana
  // Maps to our API proficiency IDs: 1=Sabre, 2=Dagger, 3=Axe, 4=Spear, 5=Bow, 6=Staff, 7=Melee, 8=Harp, 9=Gun, 10=Katana
  const profMap = [1, 2, 4, 3, 6, 9, 7, 5, 8, 10] // filter position -> API proficiency ID
  const profStr = filter['8']
  if (profStr && typeof profStr === 'string' && profStr !== '0000000000') {
    result.proficiencies = []
    for (let i = 0; i < profStr.length; i++) {
      if (profStr[i] === '1') {
        result.proficiencies.push(profMap[i])
      }
    }
    if (result.proficiencies.length === 0) result.proficiencies = null
  }

  // Return null if no filters active
  if (!result.elements && !result.proficiencies) return null
  return result
}

/**
 * Check if any meaningful filter is active in the cached pages
 */
function extractFilterFromPages(pagesData) {
  // Check the first page for filter options (all pages should have same filter)
  for (const pageData of Object.values(pagesData)) {
    if (pageData?.options?.filter || pageData?.option?.filter) {
      const options = pageData.options || pageData.option
      return parseGameFilter(options)
    }
  }
  return null
}

async function previewSyncDeletions(pagesData, dataType) {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: `Unknown collection type: ${dataType}` }

  const allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'No items found in collection data' }

  const activeFilter = extractFilterFromPages(pagesData)
  const result = await authenticatedPost(`/collection/${endpoint}/preview_sync`, {
    data: { list: allItems },
    filter: activeFilter
  })
  if (result.error) return result
  return { willDelete: result.data.will_delete || [], count: result.data.count || 0 }
}

async function checkConflicts(pagesData, dataType) {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: `Unknown collection type: ${dataType}` }

  const allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'No items found in collection data' }

  const result = await authenticatedPost(`/collection/${endpoint}/check_conflicts`, {
    data: { list: allItems }
  })
  if (result.error) return result
  return { conflicts: result.data.conflicts || [] }
}

async function uploadCollectionData(pagesData, dataType, options = {}) {
  const { updateExisting = false, isFullInventory = false, reconcileDeletions = false, conflictResolutions = null } = options

  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: `Unknown collection type: ${dataType}` }

  const allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'No items found in collection data' }

  const activeFilter = extractFilterFromPages(pagesData)
  const body = {
    data: { list: allItems },
    update_existing: updateExisting,
    is_full_inventory: isFullInventory,
    reconcile_deletions: reconcileDeletions,
    filter: activeFilter
  }

  if (conflictResolutions) {
    body.conflict_resolutions = conflictResolutions
  }

  const result = await authenticatedPost(`/collection/${endpoint}/import`, body)
  if (result.error) return result

  // Invalidate collection IDs cache so dimming updates
  collectionIdsCache = null

  return {
    success: result.data.success,
    created: result.data.created || 0,
    updated: result.data.updated || 0,
    skipped: result.data.skipped || 0,
    errors: result.data.errors || [],
    reconciliation: result.data.reconciliation || null
  }
}

async function uploadCharacterStats(statsData) {
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

  const result = await authenticatedPost('/collection/characters/import', {
    data: { list: items },
    update_existing: true
  })
  if (result.error) return result

  collectionIdsCache = null

  return {
    success: result.data.success,
    created: result.data.created || 0,
    updated: result.data.updated || 0,
    skipped: result.data.skipped || 0,
    errors: result.data.errors || []
  }
}

async function fetchUserPlaylists() {
  try {
    const auth = await getAuthToken()
    const response = await fetch(`${await getApiUrl(`/users/${auth.user.username}/playlists?per_page=100`)}`, {
      headers: { 'Authorization': `Bearer ${auth.access_token}` }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return { data }
  } catch (error) {
    console.error('Failed to fetch playlists:', error)
    return { error: error.message }
  }
}

async function createPlaylist({ title, description, visibility }) {
  try {
    const result = await authenticatedPost('/playlists', {
      playlist: { title, description, visibility: visibility || 3 }
    })
    return result
  } catch (error) {
    console.error('Failed to create playlist:', error)
    return { error: error.message }
  }
}

async function fetchRaidGroups(forceRefresh = false) {
  const cacheKey = CACHE_KEYS.raid_groups
  const result = await chrome.storage.local.get(cacheKey)
  const cached = result[cacheKey]

  if (!forceRefresh && cached && cached.timestamp && (Date.now() - cached.timestamp) < RAID_GROUPS_CACHE_TTL_MS) {
    return { data: cached.data }
  }

  const auth = await getAuthToken()
  if (!auth) return { error: 'Not logged in. Please log in first.' }

  const apiUrl = await getApiUrl('/raid_groups')
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.access_token}`
      }
    })

    if (!response.ok) {
      return { error: await parseErrorResponse(response) }
    }

    const data = await response.json()

    await chrome.storage.local.set({
      [cacheKey]: {
        data: data,
        timestamp: Date.now()
      }
    })

    return { data }
  } catch (error) {
    return { error: `Request failed: ${error.message}` }
  }
}

async function getCollectionIds() {
  const now = Date.now()
  if (collectionIdsCache && (now - collectionIdsCacheTime) < COLLECTION_IDS_TTL_MS) {
    return collectionIdsCache
  }

  const auth = await getAuthToken()
  if (!auth) return { error: 'Not logged in' }

  const userId = auth.user?.id
  if (!userId) return { error: 'No user ID' }

  const apiUrl = await getApiUrl(`/users/${userId}/collection/game_ids`)
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.access_token}`
      }
    })

    if (!response.ok) return { error: `Request failed (${response.status})` }

    const data = await response.json()
    collectionIdsCache = data
    collectionIdsCacheTime = now
    return data
  } catch (error) {
    return { error: error.message }
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
