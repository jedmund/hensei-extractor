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
  party: 'gbf_cache_party',
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
  const { url, data, dataType, pageNumber, timestamp } = event.detail

  if (!data || !dataType) {
    return
  }

  try {
    if (dataType.startsWith('list_') || dataType.startsWith('collection_')) {
      // For list/collection data, accumulate pages
      await cacheListPage(dataType, pageNumber, data, timestamp)
    } else {
      // For single items (party, details), replace cache
      await cacheSingleItem(dataType, data, timestamp, url)
    }

    // Notify popup that new data is available
    chrome.runtime.sendMessage({
      action: 'dataCaptured',
      dataType: dataType,
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
 * Cache a single item (party, character detail, etc.)
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
  const cacheKey = CACHE_KEYS[dataType]
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
  const allKeys = Object.values(CACHE_KEYS)
  const result = await chrome.storage.local.get(allKeys)

  const status = {}
  const now = Date.now()

  for (const [type, key] of Object.entries(CACHE_KEYS)) {
    const cached = result[key]
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

  return status
}

/**
 * Clear cached data
 */
async function handleClearCache(dataType) {
  if (dataType) {
    const cacheKey = CACHE_KEYS[dataType]
    if (cacheKey) {
      await chrome.storage.local.remove(cacheKey)
    }
  } else {
    // Clear all cache
    await chrome.storage.local.remove(Object.values(CACHE_KEYS))
  }
  return { success: true }
}

// Start the content script
init()
