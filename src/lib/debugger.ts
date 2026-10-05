/**
 * Network interception using Chrome DevTools Debugger Protocol.
 * This approach is completely invisible to the page - no modified globals,
 * no injected scripts. We intercept at the browser level.
 *
 * SAFETY: This module only READS responses the game already receives.
 * It never makes additional requests or modifies game behavior.
 */

import {
  buildInterceptMetadata,
  GBF_DOMAINS,
  getDataType,
  type InterceptMetadata,
  isGameUrl,
  isStashContentUrl,
  matchesPageContext,
  parseStashName,
  requiresPageContext,
  shouldIntercept
} from './intercept-routes.js'

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
  const url = changeInfo.url ?? tab.url
  if (isGameUrl(url)) {
    if (changeInfo.status === 'complete') doAttach(tabId)
  } else if (url) {
    // The tab left the game: stop reading its traffic.
    doDetach(tabId)
  }
}

function handleTabRemoved(tabId: number): void {
  attachedTabs.delete(tabId)
  forgetPendingRequests(tabId)
}

function forgetPendingRequests(tabId: number): void {
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
  forgetPendingRequests(tabId)

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

    await processInterceptedData(pending.url, data, pending.timestamp, tabId)
  } catch {
    // Response might not be JSON, or request might have failed
  }
}

// ==========================================
// INTERNAL: DATA PROCESSING
// ==========================================

async function processInterceptedData(
  url: string,
  data: unknown,
  timestamp: number,
  tabId: number
): Promise<void> {
  if (isStashContentUrl(url)) {
    // A page without a name keeps the last one seen.
    const stashName = parseStashName(data as { data?: string })
    if (stashName !== null) lastStashName = stashName
    return
  }

  if (!onDataIntercepted) return

  const dataType = getDataType(url)

  if (!(await isValidPageContext(tabId, dataType))) return

  const metadata = buildInterceptMetadata(url, data, dataType, lastStashName)

  onDataIntercepted(url, data, dataType, metadata, timestamp)
}

async function isValidPageContext(
  tabId: number,
  dataType: string
): Promise<boolean> {
  if (!requiresPageContext(dataType)) return true

  try {
    const tab = await chrome.tabs.get(tabId)
    return matchesPageContext(dataType, tab.url)
  } catch {
    return false
  }
}
