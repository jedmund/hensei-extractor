/**
 * Pure shaping of an Evoker's party deck (GET /rest/arcarum3/party/deck/):
 * what's kept at capture time, which deck goes with a report, and the
 * POST /import body.
 *
 * Only `deck` and `bullet_info` are kept. `deck.pc.param.id` is the
 * player's uid and is removed before the deck is cached or uploaded.
 */

import type {
  SolomonisDeck,
  SolomonisPartyImportBody,
  SolomonisPartyImportOptions,
  SolomonisReport
} from './types.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The deck to keep: `deck` and `bullet_info`, without the player's uid.
 * Accepts the full response or an already shaped deck. Null when there's
 * no Solomonis deck in it. Never changes `response`.
 */
export function shapeDeck(response: unknown): SolomonisDeck | null {
  if (!isRecord(response) || !isRecord(response.deck)) return null
  const deck = response.deck
  if (deckPriorityOf(deck) === null) return null

  const shaped: SolomonisDeck = { deck: { ...deck } }
  if (isRecord(deck.pc)) {
    const pc = { ...deck.pc }
    if (isRecord(pc.param)) {
      const param = { ...pc.param }
      delete param.id
      pc.param = param
    }
    shaped.deck.pc = pc
  }
  if (response.bullet_info !== undefined) {
    shaped.bullet_info = response.bullet_info
  }
  return shaped
}

function deckPriorityOf(deck: Record<string, unknown>): string | null {
  const priority = deck.priority
  if (typeof priority === 'number' && Number.isSafeInteger(priority)) {
    return priority >= 0 ? String(priority) : null
  }
  if (typeof priority === 'string' && /^\d+$/.test(priority)) return priority
  return null
}

/** The deck's `priority`, which keys its cache entry. */
export function deckPriority(deck: SolomonisDeck): string | null {
  return deckPriorityOf(deck.deck)
}

/** The route Evoker: the character in the deck's first slot. */
export function deckEvoker(
  deck: SolomonisDeck
): { id: string; name: string | null } | null {
  const master = deck.deck.npc?.['1']?.master
  const id = master?.id
  if (id === undefined || id === null || String(id) === '') return null
  return {
    id: String(id),
    name: typeof master?.name === 'string' ? master.name : null
  }
}

/**
 * The Evoker a report was run with, from its `thumbnail_image`
 * (`<granblue id>_<art>`). Null when it isn't there.
 */
export function reportEvokerId(
  report: Pick<SolomonisReport, 'thumbnail_image'> | null | undefined
): string | null {
  const image = report?.thumbnail_image
  if (typeof image !== 'string') return null
  const match = image.match(/^(\d+)(?:_|$)/)
  return match ? match[1]! : null
}

export interface DeckCandidate {
  dataType: string
  evokerId?: string | null
  timestamp?: number
  lastUpdated?: number
}

/**
 * The captured decks that can go with a report: those for the report's
 * Evoker, most recently captured first.
 */
export function matchingDecks<T extends DeckCandidate>(
  decks: T[],
  evokerId: string | null
): T[] {
  if (!evokerId) return []
  const time = (deck: T) => deck.timestamp ?? deck.lastUpdated ?? 0
  return decks
    .filter((deck) => deck.evokerId === evokerId)
    .sort((a, b) => time(b) - time(a))
}

/**
 * The POST /import body for a captured deck, or null if it isn't one.
 * Shaped again here so the uid can't reach the API, whatever the cache
 * holds.
 */
export function buildPartyImportBody(
  captured: unknown,
  options: SolomonisPartyImportOptions = {}
): SolomonisPartyImportBody | null {
  const deck = shapeDeck(captured)
  if (!deck) return null

  const body: SolomonisPartyImportBody = {
    kind: 'solomonis_party',
    playlist_ids: options.playlistIds ?? [],
    solomonis: { deck }
  }
  const name = options.name?.trim()
  if (name) body.name = name
  if (options.visibility) body.visibility = options.visibility
  return body
}
