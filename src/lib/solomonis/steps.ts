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
 * Pages are game hashes (`#…`), as the game itself shows them in the
 * address bar, opened in the player's game tab. The game then loads them
 * as if the player had navigated there; the extension never requests
 * anything from the game.
 */

import { matchingDecks, type DeckCandidate } from './deck.js'
import type { SolomonisRunCapture } from './types.js'

/** The expedition log of one report. */
export function reportLogPage(reportId: string): string {
  return `#arcarum3/dungeon_report_detail/id=${reportId}&prev_page=1`
}

/** The guidebook log of one report. */
export function reportBookPage(reportId: string): string {
  return `#arcarum3/dungeon_report_book/id=${reportId}`
}

/**
 * Each Evoker's character ID in the game, which is also the Solomonis party
 * group (`combination_group_id`), by their granblue_id.
 */
const EVOKER_CHARACTER_IDS: Record<string, string> = {
  '3040160000': '3099', // Maria Theresa
  '3040161000': '3100', // Fraux
  '3040162000': '3101', // Geisenborger
  '3040163000': '3102', // Estarriola
  '3040164000': '3103', // Caim
  '3040165000': '3104', // Lobelia
  '3040166000': '3105', // Katzelia
  '3040167000': '3106', // Alanaan
  '3040168000': '3107', // Haaselia
  '3040169000': '3108' // Nier
}

/**
 * An Evoker's first party, which loads its party deck
 * (GET /rest/arcarum3/party/deck/<group><deck>). The game keeps the address
 * when the player switches to another of the Evoker's parties, and that
 * switch loads the other deck. Null for an unknown Evoker.
 */
export function evokerPartyPage(
  evokerId: string | null | undefined
): string | null {
  const group = evokerId ? EVOKER_CHARACTER_IDS[evokerId] : undefined
  return group ? `#party/index/${group}1/npc/0` : null
}

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
  /** The route Evoker's granblue_id, from the expedition log */
  evokerId: string | null
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
      page: evokerPartyPage(input.evokerId)
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
