/**
 * Caches expedition reports and Evokers' party decks for the side panel.
 *
 * Reports: one entry per report ID, holding whichever of the two logs have
 * been captured. Only the shaped report and the guidebook are stored; never
 * the request URL (it carries the player's uid), `display_list`, `langMsg`
 * or the HTML `data`.
 *
 * Decks: one entry per `deck.priority`, read from the body. Only the shaped
 * deck is stored (no uid), never the request URL.
 */

import { CACHE_PREFIXES } from '../constants.js'
import { decodeHtmlEntities } from '../html-entities.js'
import { deckEvoker, deckPriority, reportEvokerId, shapeDeck } from './deck.js'
import {
  emptyCapture,
  mergeCapture,
  shapeReport,
  shapeStatusList
} from './report.js'
import {
  SOLOMONIS_DECK,
  SOLOMONIS_REPORT,
  SOLOMONIS_RUN,
  solomonisDeckDataType,
  solomonisRunDataType,
  type SolomonisReportDataType
} from './routes.js'
import type {
  SolomonisDeckCacheEntry,
  SolomonisRunCacheEntry,
  SolomonisRunCapture
} from './types.js'

export function solomonisRunCacheKey(reportId: string): string {
  return CACHE_PREFIXES[SOLOMONIS_RUN]! + reportId
}

// Both logs of a report write the same entry, so writes to one key run one
// after another instead of overwriting each other's half.
const pendingWrites = new Map<string, Promise<unknown>>()

function serialized<T>(key: string, write: () => Promise<T>): Promise<T> {
  const previous = pendingWrites.get(key) ?? Promise.resolve()
  const next = previous.then(write, write)
  pendingWrites.set(key, next)
  void next.finally(() => {
    if (pendingWrites.get(key) === next) pendingWrites.delete(key)
  })
  return next
}

/**
 * Stores one log of a report. Returns the side panel data type it was
 * cached under (`solomonis_run_<id>`), or null if the response had nothing
 * to keep.
 */
export async function cacheSolomonisReport(
  dataType: SolomonisReportDataType,
  reportId: string | null,
  data: unknown,
  timestamp: number
): Promise<string | null> {
  if (!reportId) return null

  let merge: (existing: SolomonisRunCapture) => SolomonisRunCapture
  if (dataType === SOLOMONIS_REPORT) {
    const report = shapeReport(data)
    if (!report) return null
    merge = (existing) => mergeCapture(existing, { report, timestamp })
  } else {
    const statusList = shapeStatusList(data)
    if (!statusList) return null
    merge = (existing) => mergeCapture(existing, { statusList, timestamp })
  }

  const key = solomonisRunCacheKey(reportId)
  return serialized(key, async () => {
    const stored = (await chrome.storage.local.get(key))[key] as
      | SolomonisRunCacheEntry
      | undefined
    const existing =
      stored?.data?.reportId === reportId ? stored.data : emptyCapture(reportId)
    const capture = merge(existing)
    const deckName = capture.report?.deck_name
    const entry: SolomonisRunCacheEntry = {
      data: capture,
      timestamp,
      reportId,
      deckName:
        typeof deckName === 'string'
          ? decodeHtmlEntities(deckName).trim()
          : null,
      evokerId: reportEvokerId(capture.report),
      hasReport: !!capture.report,
      hasBook: !!capture.statusList
    }
    await chrome.storage.local.set({ [key]: entry })
    return solomonisRunDataType(reportId)
  })
}

export function solomonisDeckCacheKey(priority: string): string {
  return CACHE_PREFIXES[SOLOMONIS_DECK]! + priority
}

/**
 * Stores an Evoker's party deck, replacing an earlier capture of the same
 * deck. Returns the side panel data type (`solomonis_deck_<priority>`), or
 * null if the response isn't a deck.
 */
export async function cacheSolomonisDeck(
  data: unknown,
  timestamp: number
): Promise<string | null> {
  const deck = shapeDeck(data)
  const priority = deck ? deckPriority(deck) : null
  if (!deck || !priority) return null

  const evoker = deckEvoker(deck)
  const name = deck.deck.name
  const entry: SolomonisDeckCacheEntry = {
    data: deck,
    timestamp,
    priority,
    deckName:
      typeof name === 'string' ? decodeHtmlEntities(name).trim() || null : null,
    evokerId: evoker?.id ?? null,
    evokerName: evoker?.name ? decodeHtmlEntities(evoker.name) : null
  }
  await chrome.storage.local.set({ [solomonisDeckCacheKey(priority)]: entry })
  return solomonisDeckDataType(priority)
}
