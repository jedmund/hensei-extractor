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
 * The URL of a game page in the tab: its own URL with only the hash
 * changed, so the game moves to the page without reloading (it also runs on
 * Mobage and Steam hosts, whose URLs carry a query). A new tab gets the main
 * game host.
 */
export function gamePageUrl(tabUrl: string | undefined, hash: string): string {
  const url = new URL(isGameUrl(tabUrl) ? tabUrl! : `${DEFAULT_GAME_ORIGIN}/`)
  url.hash = hash.startsWith('#') ? hash.slice(1) : hash
  return url.toString()
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

/**
 * A character's Character Bonuses screen (能力強化), where its ring and
 * earring bonuses load. Takes the character's granblue_id.
 */
export function characterBonusesPage(granblueId: string): string {
  return `#zenith/npc/list/${granblueId}/-1/1`
}
