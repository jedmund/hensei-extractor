/**
 * Pure shaping of the game's expedition reports: what's kept at capture
 * time, how the two logs pair up, and the POST /import body.
 *
 * The expedition log's response also holds `data` (an empty HTML mount
 * point), `option.langMsg` (UI strings) and `display_list` (the player's
 * inventory with their user ID). None of them are kept or uploaded.
 */

import { shapeDeck } from './deck.js'
import type {
  SolomonisReport,
  SolomonisRunCapture,
  SolomonisRunImportBody,
  SolomonisRunImportOptions,
  SolomonisStatus
} from './types.js'

/** Keys dropped from the expedition log's `option`. */
const DROPPED_REPORT_KEYS = new Set(['langMsg', 'display_list'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The expedition log's `option` without `langMsg`. Accepts either the full
 * response or `option` itself, so a report that was already shaped passes
 * through unchanged. Null when there's no report in it.
 */
export function shapeReport(response: unknown): SolomonisReport | null {
  if (!isRecord(response)) return null
  const option = isRecord(response.option) ? response.option : response
  if (!('dungeon_report_id' in option)) return null

  const report: SolomonisReport = {}
  for (const [key, value] of Object.entries(option)) {
    if (!DROPPED_REPORT_KEYS.has(key)) report[key] = value
  }
  return report
}

/** The guidebook log's `status_list`, unchanged. Null when missing. */
export function shapeStatusList(response: unknown): SolomonisStatus[] | null {
  if (!isRecord(response) || !Array.isArray(response.status_list)) return null
  return response.status_list.filter(isRecord) as SolomonisStatus[]
}

export function emptyCapture(reportId: string): SolomonisRunCapture {
  return {
    reportId,
    report: null,
    statusList: null,
    reportCapturedAt: null,
    bookCapturedAt: null
  }
}

/** Adds one log to a report's capture, replacing an earlier capture of it. */
export function mergeCapture(
  existing: SolomonisRunCapture,
  part:
    | { report: SolomonisReport; timestamp: number }
    | { statusList: SolomonisStatus[]; timestamp: number }
): SolomonisRunCapture {
  if ('report' in part) {
    return {
      ...existing,
      report: part.report,
      reportCapturedAt: part.timestamp
    }
  }
  return {
    ...existing,
    statusList: part.statusList,
    bookCapturedAt: part.timestamp
  }
}

export type SolomonisRunReadiness =
  | 'ready'
  | 'needs_report'
  | 'needs_book'
  | 'needs_both'

/** Whether a report can be imported, or which screen the player still needs. */
export function runReadiness(
  capture: Pick<SolomonisRunCapture, 'report' | 'statusList'> | null
): SolomonisRunReadiness {
  const hasReport = !!capture?.report
  const hasBook = !!capture?.statusList
  if (hasReport && hasBook) return 'ready'
  if (hasReport) return 'needs_book'
  if (hasBook) return 'needs_report'
  return 'needs_both'
}

/** Total guidebook stacks, to compare with the report's spacebook_status_count. */
export function guidebookStackCount(statusList: SolomonisStatus[]): number {
  return statusList.reduce(
    (sum, status) => sum + (typeof status.num === 'number' ? status.num : 0),
    0
  )
}

/**
 * The POST /import body for a captured report, or null if it can't be
 * imported. The expedition log is required. Without the guidebook log the
 * run imports with an empty guidebook, but an update is refused: it would
 * clear the guidebook imported earlier. `report` is reshaped again here so
 * nothing dropped at capture time can reach the API, whatever the cache
 * holds.
 */
export function buildRunImportBody(
  capture: SolomonisRunCapture,
  options: SolomonisRunImportOptions = {}
): SolomonisRunImportBody | null {
  const report = shapeReport(capture.report)
  const reportId = Number(capture.reportId)
  if (!report || !Number.isSafeInteger(reportId)) return null
  if (!capture.statusList && options.updateExisting) return null
  // The API requires a list; an empty one imports an empty guidebook.
  const statusList = capture.statusList ?? []

  const body: SolomonisRunImportBody = {
    kind: 'solomonis_run',
    playlist_ids: options.playlistIds ?? [],
    solomonis: {
      report_id: reportId,
      report,
      status_list: statusList
    },
    update_existing: options.updateExisting === true
  }
  const name = options.name?.trim()
  if (name) body.name = name
  if (options.visibility) body.visibility = options.visibility
  // Shaped again so the player's uid can't reach the API with the deck.
  const setup = options.currentSetup ? shapeDeck(options.currentSetup) : null
  if (setup) body.solomonis.current_setup = setup
  return body
}
