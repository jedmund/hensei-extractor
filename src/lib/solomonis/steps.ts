/**
 * The guided Solomonis import: which captures make up a run, which of them
 * are still missing, which game page captures each one, and what an import
 * leaves out without them.
 *
 * A run is imported from up to three captures:
 *
 * - the expedition log (required): outcome, pledge, turns, allies;
 * - the guidebook log (recommended): the run's guidebook;
 * - the Evoker's party deck (optional): weapons, summons and Blessings,
 *   which the report leaves out.
 *
 * Pages are game hashes (`#…`), opened in the player's game tab. Each one
 * carries at most the report ID from the path; never a query string.
 */

import { matchingDecks, type DeckCandidate } from './deck.js'
import type { SolomonisRunCapture } from './types.js'

/** The expedition log of one report. */
export function reportLogPage(reportId: string): string {
  return `#arcarum3/dungeon_report_detail/id=${reportId}`
}

/** The guidebook log of one report. */
export function reportBookPage(reportId: string): string {
  return `#arcarum3/dungeon_report_book/id=${reportId}`
}

/**
 * The screen that loads an Evoker's party deck
 * (GET /rest/arcarum3/party/deck/<group><nn>).
 *
 * TODO(solomonis): unknown. Capture the page's hash from the game (the
 * party screen reached from the Solomonis top) and set it here. While it's
 * null, the side panel tells the player which screen to open instead of
 * offering a button.
 */
export const SOLOMONIS_PARTY_PAGE: string | null = null

/**
 * The list of expedition reports.
 *
 * TODO(solomonis): unknown; the report list request hasn't been captured
 * yet (see the PRD's "Still to capture"). While it's null, the side panel
 * tells the player which screen to open instead of offering a button.
 */
export const SOLOMONIS_REPORT_LIST_PAGE: string | null = null

export type SolomonisStepKey = 'report' | 'book' | 'deck'

/**
 * - `required`: the run can't be imported without it.
 * - `recommended`: the run imports, but loses something hard to add later.
 * - `optional`: the run imports, and what's missing can be added on the web.
 */
export type SolomonisStepNeed = 'required' | 'recommended' | 'optional'

export interface SolomonisStep {
  key: SolomonisStepKey
  need: SolomonisStepNeed
  captured: boolean
  /** The game page that captures it, or null when it isn't known */
  page: string | null
}

export interface SolomonisRunStepInput {
  reportId: string
  hasReport: boolean
  hasBook: boolean
  /** Whether a captured party deck goes with the report (D26 pairing) */
  hasDeck: boolean
}

/** The run's captures, in the order the player should open them. */
export function runSteps(input: SolomonisRunStepInput): SolomonisStep[] {
  return [
    {
      key: 'report',
      need: 'required',
      captured: input.hasReport,
      page: reportLogPage(input.reportId)
    },
    {
      key: 'book',
      need: 'recommended',
      captured: input.hasBook,
      page: reportBookPage(input.reportId)
    },
    {
      key: 'deck',
      need: 'optional',
      captured: input.hasDeck,
      page: SOLOMONIS_PARTY_PAGE
    }
  ]
}

export interface SolomonisRunImportPlan {
  /** Every required capture is there */
  canImport: boolean
  /** Required captures still missing: these block the import */
  blocking: SolomonisStepKey[]
  /** Captures the import goes ahead without, so it'll leave them empty */
  without: SolomonisStepKey[]
}

/** Whether the run can be imported, and what it would be missing. */
export function runImportPlan(steps: SolomonisStep[]): SolomonisRunImportPlan {
  const missing = steps.filter((step) => !step.captured)
  const blocking = missing
    .filter((step) => step.need === 'required')
    .map((step) => step.key)
  return {
    canImport: blocking.length === 0,
    blocking,
    without: missing
      .filter((step) => step.need !== 'required')
      .map((step) => step.key)
  }
}

/**
 * Whether an already imported run may be updated from this capture.
 * Updating replaces the party's guidebook, so without the guidebook log it
 * would clear one imported earlier.
 */
export function canUpdateImportedRun(hasBook: boolean): boolean {
  return hasBook
}

export interface RunCandidate extends DeckCandidate {
  hasReport?: boolean
  hasBook?: boolean
}

/**
 * The captured reports that go with a party deck: those run with the deck's
 * Evoker, most recently captured first. The same pairing as a report's deck
 * (D26), read from the other side.
 */
export function matchingRuns<T extends RunCandidate>(
  runs: T[],
  evokerId: string | null
): T[] {
  return matchingDecks(runs, evokerId)
}

/** Whether a cached run can be imported: its expedition log is captured. */
export function canImportRun(
  capture: Pick<
    SolomonisRunCapture,
    'reportId' | 'report' | 'statusList'
  > | null
): boolean {
  if (!capture) return false
  return runImportPlan(
    runSteps({
      reportId: capture.reportId,
      hasReport: !!capture.report,
      hasBook: !!capture.statusList,
      hasDeck: false
    })
  ).canImport
}
