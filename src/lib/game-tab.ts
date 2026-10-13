/**
 * Takes the player's game tab to a game page (a `#…` hash), so the
 * extension captures what that page loads. An open game tab is reused: it's
 * already being read, and the player stays logged in to it. A new tab opens
 * only when there's none.
 */

import { GBF_DOMAINS, isGameUrl } from './intercept-routes.js'

const DEFAULT_GAME_ORIGIN = `https://${GBF_DOMAINS[0]}`

export interface GameTabCandidate {
  id?: number
  url?: string
  active?: boolean
  lastAccessed?: number
}

/**
 * The game tab to use: the active one if the player is looking at the
 * game, otherwise the one used most recently. Null without a game tab.
 */
export function pickGameTab<T extends GameTabCandidate>(tabs: T[]): T | null {
  const game = tabs.filter((tab) => tab.id != null && isGameUrl(tab.url))
  if (game.length === 0) return null
  return (
    game.find((tab) => tab.active) ??
    [...game].sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0]!
  )
}

/**
 * The URL of a game page on the same host as the tab (the game also runs on
 * Mobage and Steam hosts). Keeps nothing of the tab's path or query.
 */
export function gamePageUrl(tabUrl: string | undefined, hash: string): string {
  const origin = isGameUrl(tabUrl)
    ? new URL(tabUrl!).origin
    : DEFAULT_GAME_ORIGIN
  const fragment = hash.startsWith('#') ? hash : `#${hash}`
  return `${origin}/${fragment}`
}

/** Opens a game page in the player's game tab, or in a new tab. */
export async function openGamePage(hash: string): Promise<void> {
  const tabs = await chrome.tabs.query({
    url: GBF_DOMAINS.map((domain) => `https://${domain}/*`)
  })
  const tab = pickGameTab(tabs)
  if (!tab?.id) {
    await chrome.tabs.create({ url: gamePageUrl(undefined, hash) })
    return
  }
  await chrome.tabs.update(tab.id, {
    url: gamePageUrl(tab.url, hash),
    active: true
  })
  if (tab.windowId != null) {
    await chrome.windows.update(tab.windowId, { focused: true })
  }
}
