/**
 * Caches expedition reports for the side panel: one entry per report ID,
 * holding whichever of the two logs have been captured. Only the shaped
 * report and the guidebook are stored; never the request URL (it carries
 * the player's uid), `display_list`, `langMsg` or the HTML `data`.
 */

import { CACHE_PREFIXES } from '../constants.js'
import { decodeHtmlEntities } from '../html-entities.js'
import {
  emptyCapture,
  mergeCapture,
  shapeReport,
  shapeStatusList
} from './report.js'
import {
  SOLOMONIS_REPORT,
  SOLOMONIS_RUN,
  solomonisRunDataType,
  type SolomonisReportDataType
} from './routes.js'
import type { SolomonisRunCacheEntry, SolomonisRunCapture } from './types.js'

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
      hasReport: !!capture.report,
      hasBook: !!capture.statusList
    }
    await chrome.storage.local.set({ [key]: entry })
    return solomonisRunDataType(reportId)
  })
}
