/**
 * @fileoverview Network interception using Chrome DevTools Debugger Protocol.
 * This approach is completely invisible to the page - no modified globals,
 * no injected scripts. We intercept at the browser level.
 *
 * SAFETY: This module only READS responses the game already receives.
 * It never makes additional requests or modifies game behavior.
 */

// ==========================================
// ENDPOINT PATTERNS TO INTERCEPT
// ==========================================

const INTERCEPT_PATTERNS = [
  '/party/deck',
  '/archive/npc_detail',
  '/archive/weapon_detail',
  '/archive/summon_detail',
  '/npc/list/',
  '/weapon/list/',
  '/summon/list/',
  // Collection pages (inventory)
  '/rest/weapon/list/',
  '/rest/npc/list/',
  '/rest/summon/list/',
  '/rest/artifact/list/',
  // Character detail page (for awakening data)
  '/npc/npc/',
  // Zenith/EMP pages (for mastery bonuses)
  '/npczenith/bonus_list/',
  '/npczenith/content/index/'
]

// ==========================================
// STATE TRACKING
// ==========================================

// Track attached tabs
const attachedTabs = new Set()

// Track pending requests waiting for response body
// Map<requestId, { url, tabId }>
const pendingRequests = new Map()

// Callback for when data is intercepted
let onDataIntercepted = null

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Initialize the debugger interception system
 * @param {Function} callback - Called with (url, data, dataType, metadata) when data is intercepted
 */
export function initDebugger(callback) {
  onDataIntercepted = callback

  // Listen for debugger events
  chrome.debugger.onEvent.addListener(handleDebuggerEvent)

  // Handle debugger detachment (user clicked cancel, tab closed, etc.)
  chrome.debugger.onDetach.addListener(handleDebuggerDetach)

  // Auto-attach when GBF tabs are opened/navigated
  chrome.tabs.onUpdated.addListener(handleTabUpdated)

  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener(handleTabRemoved)

  // Attach to any existing GBF tabs
  attachToExistingTabs()
}

/**
 * Check if we're attached to a GBF tab
 * @returns {boolean}
 */
export function isAttached() {
  return attachedTabs.size > 0
}

/**
 * Get list of attached tab IDs
 * @returns {number[]}
 */
export function getAttachedTabs() {
  return Array.from(attachedTabs)
}

/**
 * Manually attach to a tab
 * @param {number} tabId
 */
export async function attachToTab(tabId) {
  await doAttach(tabId)
}

/**
 * Manually detach from a tab
 * @param {number} tabId
 */
export async function detachFromTab(tabId) {
  await doDetach(tabId)
}

// ==========================================
// INTERNAL: TAB MANAGEMENT
// ==========================================

/**
 * Attach to any existing GBF tabs on startup
 */
async function attachToExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://game.granbluefantasy.jp/*' })
    for (const tab of tabs) {
      await doAttach(tab.id)
    }
  } catch (e) {
    console.error('[Debugger] Error attaching to existing tabs:', e)
  }
}

/**
 * Handle tab updates - attach when GBF is loaded
 */
function handleTabUpdated(tabId, changeInfo, tab) {
  if (tab.url?.includes('game.granbluefantasy.jp') && changeInfo.status === 'complete') {
    doAttach(tabId)
  }
}

/**
 * Handle tab removal - clean up
 */
function handleTabRemoved(tabId) {
  attachedTabs.delete(tabId)
  // Clean up any pending requests for this tab
  for (const [requestId, info] of pendingRequests) {
    if (info.tabId === tabId) {
      pendingRequests.delete(requestId)
    }
  }
}

/**
 * Attach debugger to a tab
 */
async function doAttach(tabId) {
  if (attachedTabs.has(tabId)) return

  try {
    // Attach debugger with protocol version 1.3
    await chrome.debugger.attach({ tabId }, '1.3')

    // Enable network tracking
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable')

    attachedTabs.add(tabId)
    console.log(`[Debugger] Attached to tab ${tabId}`)
  } catch (e) {
    // Common errors: already attached, tab doesn't exist, user denied
    if (!e.message?.includes('Another debugger is already attached')) {
      console.error(`[Debugger] Failed to attach to tab ${tabId}:`, e.message)
    }
  }
}

/**
 * Detach debugger from a tab
 */
async function doDetach(tabId) {
  if (!attachedTabs.has(tabId)) return

  try {
    await chrome.debugger.detach({ tabId })
    attachedTabs.delete(tabId)
    console.log(`[Debugger] Detached from tab ${tabId}`)
  } catch (e) {
    // Tab might already be closed
    attachedTabs.delete(tabId)
  }
}

/**
 * Handle debugger detachment events
 */
function handleDebuggerDetach(source, reason) {
  attachedTabs.delete(source.tabId)
  console.log(`[Debugger] Detached from tab ${source.tabId}: ${reason}`)
}

// ==========================================
// INTERNAL: NETWORK INTERCEPTION
// ==========================================

/**
 * Handle debugger protocol events
 */
async function handleDebuggerEvent(source, method, params) {
  const { tabId } = source

  if (method === 'Network.responseReceived') {
    handleResponseReceived(tabId, params)
  } else if (method === 'Network.loadingFinished') {
    await handleLoadingFinished(tabId, params)
  }
}

/**
 * Handle Network.responseReceived - track requests we want to capture
 */
function handleResponseReceived(tabId, params) {
  const { requestId, response } = params
  const url = response.url

  // Only track requests matching our patterns
  if (shouldIntercept(url)) {
    pendingRequests.set(requestId, {
      url,
      tabId,
      timestamp: Date.now()
    })
  }
}

/**
 * Handle Network.loadingFinished - get response body and process
 */
async function handleLoadingFinished(tabId, params) {
  const { requestId } = params
  const pending = pendingRequests.get(requestId)

  if (!pending) return

  pendingRequests.delete(requestId)

  try {
    // Get the response body
    const result = await chrome.debugger.sendCommand(
      { tabId: pending.tabId },
      'Network.getResponseBody',
      { requestId }
    )

    // Decode body if base64 encoded
    let bodyText = result.body
    if (result.base64Encoded) {
      bodyText = atob(result.body)
    }

    // Parse as JSON
    const data = JSON.parse(bodyText)

    // Process the intercepted data
    processInterceptedData(pending.url, data, pending.timestamp)
  } catch (e) {
    // Response might not be JSON, or request might have failed
    // This is normal for non-JSON responses, don't log unless debugging
  }
}

/**
 * Check if a URL matches our intercept patterns
 */
function shouldIntercept(url) {
  if (!url) return false
  return INTERCEPT_PATTERNS.some(pattern => url.includes(pattern))
}

// ==========================================
// INTERNAL: DATA PROCESSING
// ==========================================

/**
 * Process intercepted data and notify callback
 */
function processInterceptedData(url, data, timestamp) {
  if (!onDataIntercepted) return

  const dataType = getDataType(url)
  const metadata = {
    pageNumber: getPageNumber(url),
    partyId: dataType === 'party' ? getPartyId(url, data) : null,
    masterId: getMasterId(url, data, dataType)
  }

  onDataIntercepted(url, data, dataType, metadata, timestamp)
}

/**
 * Determine the data type from the URL
 */
function getDataType(url) {
  if (url.includes('/party/deck')) return 'party'
  if (url.includes('/archive/npc_detail')) return 'detail_npc'
  if (url.includes('/archive/weapon_detail')) return 'detail_weapon'
  if (url.includes('/archive/summon_detail')) return 'detail_summon'
  if (url.includes('/npc/npc/')) return 'character_detail'
  if (url.includes('/npczenith/bonus_list/')) return 'zenith_npc'
  if (url.includes('/npczenith/content/index/')) return 'zenith_npc'
  if (url.includes('/rest/weapon/list/')) return 'collection_weapon'
  if (url.includes('/rest/npc/list/')) return 'collection_npc'
  if (url.includes('/rest/summon/list/')) return 'collection_summon'
  if (url.includes('/rest/artifact/list/')) return 'collection_artifact'
  if (url.includes('/npc/list/')) return 'list_npc'
  if (url.includes('/weapon/list/')) return 'list_weapon'
  if (url.includes('/summon/list/')) return 'list_summon'
  return 'unknown'
}

/**
 * Extract page number from list URL
 */
function getPageNumber(url) {
  const match = url.match(/\/list\/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Extract party ID from URL or data
 */
function getPartyId(url, data) {
  // Try URL pattern first: /party/deck/{group}/{slot}
  const urlMatch = url.match(/\/party\/deck\/(\d+)\/(\d+)/)
  if (urlMatch) {
    return `${urlMatch[1]}_${urlMatch[2]}`
  }

  // Fall back to data
  if (data?.deck) {
    if (data.deck.priority !== undefined) {
      return `deck_${data.deck.priority}`
    }
    if (data.deck.name) {
      return data.deck.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)
    }
  }

  return null
}

/**
 * Extract master ID for character stats data
 */
function getMasterId(url, data, dataType) {
  if (dataType === 'zenith_npc') {
    // Try bonus_list pattern
    let match = url.match(/\/npczenith\/bonus_list\/(\d+)/)
    if (match) return match[1]

    // Try content/index pattern
    match = url.match(/\/npczenith\/content\/index\/(\d+)/)
    if (match) return match[1]
  } else if (dataType === 'character_detail') {
    return data?.master?.id || null
  }

  return null
}
