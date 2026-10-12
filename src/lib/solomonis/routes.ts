/**
 * Evoking Solomonis expedition reports. After an expedition the game keeps
 * a report for it, read from two screens:
 *
 * - expedition log: GET /arcarum3/dungeon/report/content/detail/<report id>
 * - guidebook log:  GET /arcarum3/dungeon/report/content/spacebook/<report id>
 *
 * Both requests carry the player's uid in the query string, so everything
 * here reads the URL's path only.
 */

export const SOLOMONIS_REPORT_PATTERN =
  '/arcarum3/dungeon/report/content/detail/'
export const SOLOMONIS_REPORT_BOOK_PATTERN =
  '/arcarum3/dungeon/report/content/spacebook/'

/** The expedition log (`detail`) data type. */
export const SOLOMONIS_REPORT = 'solomonis_report'
/** The guidebook log (`spacebook`) data type. */
export const SOLOMONIS_REPORT_BOOK = 'solomonis_report_book'

/**
 * Side panel data type prefix: one entry per report, holding both logs.
 * The full data type is `solomonis_run_<report id>`.
 */
export const SOLOMONIS_RUN = 'solomonis_run'

export type SolomonisReportDataType =
  | typeof SOLOMONIS_REPORT
  | typeof SOLOMONIS_REPORT_BOOK

export function isSolomonisReportDataType(
  dataType: string
): dataType is SolomonisReportDataType {
  return dataType === SOLOMONIS_REPORT || dataType === SOLOMONIS_REPORT_BOOK
}

export function isSolomonisRunDataType(dataType: string): boolean {
  return /^solomonis_run_\d+$/.test(dataType)
}

export function solomonisRunDataType(reportId: string): string {
  return `${SOLOMONIS_RUN}_${reportId}`
}

const REPORT_ID =
  /\/arcarum3\/dungeon\/report\/content\/(?:detail|spacebook)\/(\d+)(?:\/|$)/

/** The report ID from a report URL's path, or null. Never reads the query. */
export function getReportId(url: string): string | null {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }
  const match = path.match(REPORT_ID)
  return match ? match[1]! : null
}
