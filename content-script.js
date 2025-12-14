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
  detail_npc: 'gbf_cache_detail_npc',
  detail_weapon: 'gbf_cache_detail_weapon',
  detail_summon: 'gbf_cache_detail_summon',
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
  const { url, data, dataType, pageNumber, partyId, timestamp } = event.detail

  if (!data || !dataType) {
    return
  }

  try {
    let actualDataType = dataType

    if (dataType === 'party' && partyId) {
      // Store party with its unique ID
      await cacheParty(partyId, data, timestamp, url)
      actualDataType = `party_${partyId}`
    } else if (dataType.startsWith('list_') || dataType.startsWith('collection_')) {
      // For list/collection data, accumulate pages
      await cacheListPage(dataType, pageNumber, data, timestamp)
    } else {
      // For single items (details), replace cache
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
 * Cache a single item (character detail, etc.)
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
  // Handle party data types (party_1_2 format)
  let cacheKey
  if (dataType.startsWith('party_')) {
    const partyId = dataType.replace('party_', '')
    cacheKey = PARTY_CACHE_PREFIX + partyId
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
    } else {
      const cacheKey = CACHE_KEYS[dataType]
      if (cacheKey) {
        await chrome.storage.local.remove(cacheKey)
      }
    }
  } else {
    // Clear all cache including all parties
    const allStorage = await chrome.storage.local.get(null)
    const keysToRemove = [
      ...Object.values(CACHE_KEYS),
      ...Object.keys(allStorage).filter(key => key.startsWith(PARTY_CACHE_PREFIX))
    ]
    await chrome.storage.local.remove(keysToRemove)
  }
  return { success: true }
}

// Start the content script
init()
