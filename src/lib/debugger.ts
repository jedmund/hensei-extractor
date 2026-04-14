/**
 * Network interception using Chrome DevTools Debugger Protocol.
 * This approach is completely invisible to the page - no modified globals,
 * no injected scripts. We intercept at the browser level.
 *
 * SAFETY: This module only READS responses the game already receives.
 * It never makes additional requests or modifies game behavior.
 */

// ==========================================
// ENDPOINT PATTERNS TO INTERCEPT
// ==========================================

const GBF_DOMAINS = ['game.granbluefantasy.jp', 'steam.granbluefantasy.com']

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
  '/npczenith/content/index/',
  // Stash (container) pages
  '/weapon/container_list/',
  '/summon/container_list/',
  // Stash content pages (for extracting stash names from HTML)
  '/container/content/list/',
  // UNF (Unite & Fight) score pages
  '/rest/performance//total_performance/',
  '/rest/performance//todays_performance/',
  // Guild info (for crew ID)
  '/rest/guild/main/guild_info'
]

// ==========================================
// STATE TRACKING
// ==========================================

const attachedTabs = new Set<number>()

let lastStashName: string | null = null

interface PendingRequest {
  url: string
  tabId: number
  timestamp: number
}

const pendingRequests = new Map<string, PendingRequest>()

export interface InterceptMetadata {
  pageNumber: number | null
  partyId: string | null
  masterId: string | null
  stashNumber: string | null
  stashName: string | null
  eventNumber: number | null
}

type OnDataInterceptedCallback = (
  url: string,
  data: unknown,
  dataType: string,
  metadata: InterceptMetadata,
  timestamp: number
) => void

let onDataIntercepted: OnDataInterceptedCallback | null = null

// ==========================================
// PUBLIC API
// ==========================================

export function initDebugger(callback: OnDataInterceptedCallback): void {
  onDataIntercepted = callback

  chrome.debugger.onEvent.addListener(handleDebuggerEvent)
  chrome.debugger.onDetach.addListener(handleDebuggerDetach)
  chrome.tabs.onUpdated.addListener(handleTabUpdated)
  chrome.tabs.onRemoved.addListener(handleTabRemoved)

  attachToExistingTabs()
}

export function isAttached(): boolean {
  return attachedTabs.size > 0
}

export function getAttachedTabs(): number[] {
  return Array.from(attachedTabs)
}

export async function attachToTab(tabId: number): Promise<void> {
  await doAttach(tabId)
}

export async function detachFromTab(tabId: number): Promise<void> {
  await doDetach(tabId)
}

// ==========================================
// INTERNAL: TAB MANAGEMENT
// ==========================================

async function attachToExistingTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({
      url: GBF_DOMAINS.map((d) => `https://${d}/*`)
    })
    for (const tab of tabs) {
      if (tab.id != null) await doAttach(tab.id)
    }
  } catch (e) {
    console.error('[Debugger] Error attaching to existing tabs:', e)
  }
}

function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab
): void {
  if (
    GBF_DOMAINS.some((d) => tab.url?.includes(d)) &&
    changeInfo.status === 'complete'
  ) {
    doAttach(tabId)
  }
}

function handleTabRemoved(tabId: number): void {
  attachedTabs.delete(tabId)
  for (const [requestId, info] of pendingRequests) {
    if (info.tabId === tabId) {
      pendingRequests.delete(requestId)
    }
  }
}

async function doAttach(tabId: number): Promise<void> {
  if (attachedTabs.has(tabId)) return

  try {
    await chrome.debugger.attach({ tabId }, '1.3')
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable')
    attachedTabs.add(tabId)
    console.log(`[Debugger] Attached to tab ${tabId}`)
  } catch (e) {
    if (
      !(e as Error).message?.includes('Another debugger is already attached')
    ) {
      console.error(
        `[Debugger] Failed to attach to tab ${tabId}:`,
        (e as Error).message
      )
    }
  }
}

async function doDetach(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) return

  try {
    await chrome.debugger.detach({ tabId })
    attachedTabs.delete(tabId)
    console.log(`[Debugger] Detached from tab ${tabId}`)
  } catch {
    attachedTabs.delete(tabId)
  }
}

function handleDebuggerDetach(
  source: chrome.debugger.Debuggee,
  reason: string
): void {
  if (source.tabId != null) {
    attachedTabs.delete(source.tabId)
    console.log(`[Debugger] Detached from tab ${source.tabId}: ${reason}`)
  }
}

// ==========================================
// INTERNAL: NETWORK INTERCEPTION
// ==========================================

function handleDebuggerEvent(
  source: chrome.debugger.Debuggee,
  method: string,
  params?: unknown
): void {
  const { tabId } = source
  if (tabId == null) return

  if (method === 'Network.responseReceived') {
    handleResponseReceived(tabId, params as ResponseReceivedParams)
  } else if (method === 'Network.loadingFinished') {
    handleLoadingFinished(tabId, params as LoadingFinishedParams).catch(
      () => {}
    )
  }
}

interface ResponseReceivedParams {
  requestId: string
  response: { url: string }
}

interface LoadingFinishedParams {
  requestId: string
}

function handleResponseReceived(
  tabId: number,
  params: ResponseReceivedParams
): void {
  const { requestId, response } = params
  const url = response.url

  if (shouldIntercept(url)) {
    pendingRequests.set(requestId, {
      url,
      tabId,
      timestamp: Date.now()
    })
  }
}

async function handleLoadingFinished(
  tabId: number,
  params: LoadingFinishedParams
): Promise<void> {
  const { requestId } = params
  const pending = pendingRequests.get(requestId)

  if (!pending) return

  pendingRequests.delete(requestId)

  try {
    const result = (await chrome.debugger.sendCommand(
      { tabId: pending.tabId },
      'Network.getResponseBody',
      { requestId }
    )) as { body: string; base64Encoded: boolean }

    let bodyText = result.body
    if (result.base64Encoded) {
      bodyText = atob(result.body)
    }

    const data: unknown = JSON.parse(bodyText)

    processInterceptedData(pending.url, data, pending.timestamp)
  } catch {
    // Response might not be JSON, or request might have failed
  }
}

function shouldIntercept(url: string): boolean {
  if (!url) return false
  return INTERCEPT_PATTERNS.some((pattern) => url.includes(pattern))
}

// ==========================================
// INTERNAL: DATA PROCESSING
// ==========================================

function processInterceptedData(
  url: string,
  data: unknown,
  timestamp: number
): void {
  if (url.includes('/container/content/list/')) {
    extractStashName(url, data as { data?: string })
    return
  }

  if (!onDataIntercepted) return

  const dataType = getDataType(url)

  let pageNumber = getPageNumber(url)
  if (dataType.startsWith('stash_')) {
    pageNumber = (data as { current?: number })?.current ?? 1
  } else if (dataType === 'unf_scores' || dataType === 'unf_daily_scores') {
    pageNumber = getUnfPageNumber(url)
  }

  const metadata: InterceptMetadata = {
    pageNumber,
    partyId: dataType === 'party' ? getPartyId(url, data) : null,
    masterId: getMasterId(url, data, dataType),
    stashNumber: dataType.startsWith('stash_') ? getStashNumber(url) : null,
    stashName: dataType.startsWith('stash_') ? getStashName() : null,
    eventNumber: getEventNumber(url)
  }

  onDataIntercepted(url, data, dataType, metadata, timestamp)
}

function getDataType(url: string): string {
  if (url.includes('/party/deck')) return 'party'
  if (url.includes('/archive/npc_detail')) return 'detail_npc'
  if (url.includes('/archive/weapon_detail')) return 'detail_weapon'
  if (url.includes('/archive/summon_detail')) return 'detail_summon'
  if (url.includes('/npc/npc/')) return 'character_detail'
  if (url.includes('/npczenith/bonus_list/')) return 'zenith_npc'
  if (url.includes('/npczenith/content/index/')) return 'zenith_npc'
  if (url.includes('/weapon/container_list/')) return 'stash_weapon'
  if (url.includes('/summon/container_list/')) return 'stash_summon'
  if (url.includes('/rest/weapon/list/')) return 'collection_weapon'
  if (url.includes('/rest/npc/list/')) return 'collection_npc'
  if (url.includes('/rest/summon/list/')) return 'collection_summon'
  if (url.includes('/rest/artifact/list/')) return 'collection_artifact'
  if (url.includes('/npc/list/')) return 'list_npc'
  if (url.includes('/weapon/list/')) return 'list_weapon'
  if (url.includes('/summon/list/')) return 'list_summon'
  if (url.includes('/rest/performance//total_performance/')) return 'unf_scores'
  if (url.includes('/rest/performance//todays_performance/'))
    return 'unf_daily_scores'
  if (url.includes('/rest/guild/main/guild_info')) return 'guild_info'
  return 'unknown'
}

function getPageNumber(url: string): number | null {
  const match = url.match(/\/list\/(\d+)/)
  return match ? parseInt(match[1]!, 10) : null
}

function getStashNumber(url: string): string {
  const match = url.match(/\/(?:weapon|summon)\/container_list\/\d+\/(\d+)/)
  return match ? match[1]! : '1'
}

function extractStashName(_url: string, data: { data?: string }): void {
  if (!data?.data) return

  const html = decodeURIComponent(data.data)
  const nameMatch = html.match(/class="prt-container-name">([^<]+)</)
  if (nameMatch) {
    lastStashName = nameMatch[1]!.trim()
  }
}

function getStashName(): string | null {
  return lastStashName ?? null
}

function getPartyId(url: string, data: unknown): string | null {
  const urlMatch = url.match(/\/party\/deck\/(\d+)\/(\d+)/)
  if (urlMatch) {
    return `${urlMatch[1]}_${urlMatch[2]}`
  }

  const deckData = data as { deck?: { priority?: number; name?: string } }
  if (deckData?.deck) {
    if (deckData.deck.priority !== undefined) {
      return `deck_${deckData.deck.priority}`
    }
    if (deckData.deck.name) {
      return deckData.deck.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 20)
    }
  }

  return null
}

function getMasterId(
  url: string,
  data: unknown,
  dataType: string
): string | null {
  if (dataType === 'zenith_npc') {
    let match = url.match(/\/npczenith\/bonus_list\/(\d+)/)
    if (match) return match[1]!

    match = url.match(/\/npczenith\/content\/index\/(\d+)/)
    if (match) return match[1]!
  } else if (dataType === 'character_detail') {
    return (data as { master?: { id?: string } })?.master?.id ?? null
  }

  return null
}

function getEventNumber(url: string): number | null {
  const match = url.match(/\/teamraid0*(\d+)\//)
  return match ? parseInt(match[1]!, 10) : null
}

function getUnfPageNumber(url: string): number | null {
  const match = url.match(/\/(?:total|todays)_performance\/(\d+)/)
  return match ? parseInt(match[1]!, 10) : null
}
