/**
 * Evoking Solomonis run import: what the extension keeps from the game's
 * expedition reports, and what it sends to POST /import.
 */

/**
 * The expedition log's `option`, without `langMsg`. Kept as the game sends
 * it (the API parses it), so only the fields the side panel reads are typed.
 */
export interface SolomonisReport {
  dungeon_report_id?: number
  thumbnail_image?: string
  deck_name?: string
  is_success?: boolean
  difficulty?: number
  ended_at?: string
  total_turn?: string | number
  boss_count?: string | number
  spacebook_status_count?: number
  [key: string]: unknown
}

/** One guidebook log entry, kept as the game sends it. */
export interface SolomonisStatus {
  status_id?: number
  name?: string
  rarity?: number
  num?: number
  [key: string]: unknown
}

/**
 * One expedition report as cached: both logs, each captured separately.
 * A report is ready to import once both are present.
 */
export interface SolomonisRunCapture {
  reportId: string
  report: SolomonisReport | null
  statusList: SolomonisStatus[] | null
  reportCapturedAt: number | null
  bookCapturedAt: number | null
}

/** The chrome.storage entry for one report. Never holds the request URL. */
export interface SolomonisRunCacheEntry {
  data: SolomonisRunCapture
  /** The latest capture of either log */
  timestamp: number
  reportId: string
  deckName: string | null
  hasReport: boolean
  hasBook: boolean
}

/**
 * The player's party setup for the run's route Evoker, which fills in the
 * weapons, summons and blessings the report leaves out. Build capture isn't
 * implemented yet: its shape is pinned once the Evoker's party screen has
 * been captured (PRD "Builds"), so this stays the raw capture for now.
 */
export type SolomonisCurrentSetup = Record<string, unknown>

/** The `solomonis` object of a `solomonis_run` import. */
export interface SolomonisRunPayload {
  report_id: number
  report: SolomonisReport
  status_list: SolomonisStatus[]
  current_setup?: SolomonisCurrentSetup
}

/** POST /import body for a run. */
export interface SolomonisRunImportBody {
  kind: 'solomonis_run'
  name?: string
  visibility?: number
  playlist_ids: string[]
  solomonis: SolomonisRunPayload
  update_existing: boolean
}

export interface SolomonisRunImportOptions {
  name?: string
  visibility?: number
  playlistIds?: string[]
  shareWithCrew?: boolean
  /** Resend after a duplicate_report conflict to update the existing run */
  updateExisting?: boolean
  currentSetup?: SolomonisCurrentSetup | null
}
