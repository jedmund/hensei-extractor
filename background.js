/**
 * @fileoverview Background service worker for the Granblue Fantasy Chrome extension.
 * Handles message passing between popup and content scripts, and manages
 * data uploads to granblue.team API.
 *
 * IMPORTANT: This extension uses passive interception - it never makes
 * requests to GBF servers. All game data comes from intercepted responses.
 */

import { getApiUrl, getSiteBaseUrl, TIMEOUTS } from './constants.js'

// ==========================================
// MESSAGE HANDLING
// ==========================================

/**
 * Main message listener - routes messages between popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Route based on action
  switch (message.action) {
    case 'getCacheStatus':
      forwardToContentScript(message).then(sendResponse)
      return true

    case 'getCachedData':
      forwardToContentScript(message).then(sendResponse)
      return true

    case 'clearCache':
      forwardToContentScript(message).then(sendResponse)
      return true

    case 'uploadPartyData':
      uploadPartyData(message.data).then(sendResponse)
      return true

    case 'uploadDetailData':
      uploadDetailData(message.data, message.dataType).then(sendResponse)
      return true

    case 'uploadCollectionData':
      uploadCollectionData(message.data, message.dataType, message.updateExisting).then(sendResponse)
      return true

    case 'dataCaptured':
      // Forward to popup if it's listening
      chrome.runtime.sendMessage(message).catch(() => {
        // Popup not open, ignore
      })
      return false

    case 'urlReady':
      // Forward to popup
      chrome.runtime.sendMessage(message).catch(() => {})
      return false

    default:
      return false
  }
})

/**
 * Forward a message to the content script in the active GBF tab
 */
async function forwardToContentScript(message) {
  try {
    const tab = await findGBFTab()
    if (!tab) {
      return { error: 'No Granblue Fantasy tab found. Please open the game first.' }
    }

    // Ensure content script is loaded
    await ensureContentScriptLoaded(tab.id)

    // Send message and wait for response
    const response = await chrome.tabs.sendMessage(tab.id, message)
    return response
  } catch (error) {
    console.error('Error forwarding to content script:', error)
    return { error: error.message || 'Failed to communicate with game page' }
  }
}

/**
 * Find the active GBF tab, or any GBF tab if none is active
 */
async function findGBFTab() {
  // First try active tab in current window
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const activeGBF = activeTabs.find(t => t.url?.includes('game.granbluefantasy.jp'))
  if (activeGBF) return activeGBF

  // Otherwise find any GBF tab
  const allTabs = await chrome.tabs.query({ url: 'https://game.granbluefantasy.jp/*' })
  return allTabs[0] || null
}

/**
 * Ensure the content script is loaded in the tab.
 * Uses retry logic instead of fixed delay for reliability.
 */
async function ensureContentScriptLoaded(tabId) {
  const maxAttempts = TIMEOUTS.scriptInitMaxAttempts
  const baseDelay = TIMEOUTS.scriptInitBase

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'ping' })
      return // Script is loaded and responding
    } catch (error) {
      if (attempt === 0) {
        // First attempt failed - inject the scripts
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        })
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['injector.js'],
          world: 'MAIN'
        })
      }
      // Wait with exponential backoff before retrying
      await new Promise(resolve => setTimeout(resolve, baseDelay * (attempt + 1)))
    }
  }

  throw new Error('Content script failed to load after multiple attempts')
}

// ==========================================
// DATA UPLOAD (to granblue.team only)
// ==========================================

/**
 * Upload party data to granblue.team API
 * @param {Object} data - Party data to upload
 */
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

/**
 * Upload detail data (character, weapon, summon) to granblue.team API
 * @param {Object} data - Detail data to upload
 * @param {string} dataType - Type of data (detail_npc, detail_weapon, detail_summon)
 */
async function uploadDetailData(data, dataType) {
  const auth = await getAuthToken()
  if (!auth) {
    return { error: 'Not logged in. Please log in first.' }
  }

  // Map data type to endpoint
  const endpointMap = {
    'detail_npc': 'characters',
    'detail_weapon': 'weapons',
    'detail_summon': 'summons'
  }
  const endpoint = endpointMap[dataType]
  if (!endpoint) {
    return { error: `Unknown data type: ${dataType}` }
  }

  // Determine language
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

/**
 * Upload collection data (weapons, characters, summons, artifacts) to granblue.team API
 * @param {Object} pagesData - Collection data (may contain multiple pages)
 * @param {string} dataType - Type of collection (collection_weapon, collection_npc, etc.)
 * @param {boolean} updateExisting - Whether to update existing items
 */
async function uploadCollectionData(pagesData, dataType, updateExisting = false) {
  const auth = await getAuthToken()
  if (!auth) {
    return { error: 'Not logged in. Please log in first.' }
  }

  // Map data type to endpoint (both collection_ and list_ types use same endpoints)
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

  // Combine all pages into a single list
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

/**
 * Get the stored auth token
 */
async function getAuthToken() {
  const result = await chrome.storage.local.get('gbAuth')
  const auth = result.gbAuth

  if (!auth || !auth.access_token) {
    return null
  }

  // Check if token is expired
  if (auth.expires_at && Date.now() > auth.expires_at) {
    return null
  }

  return auth
}
