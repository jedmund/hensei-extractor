/**
 * Evoking Solomonis imports: what the extension keeps from the game's
 * expedition reports and Evokers' party decks, and what it sends to
 * POST /import.
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
  /** The route Evoker, from the expedition log (absent in older entries) */
  evokerId?: string | null
  hasReport: boolean
  hasBook: boolean
}

/**
 * An Evoker's party deck, as kept from GET /rest/arcarum3/party/deck/:
 * the response's `deck` (the normal deck shape plus the Solomonis fields)
 * and `bullet_info`, with `deck.pc.param.id` (the player's uid) removed.
 * Kept as the game sends it otherwise, since the API's deck processors read
 * it, so only the fields the extension reads are typed.
 */
export interface SolomonisDeck {
  deck: {
    name?: string
    group_name?: string
    priority?: number | string
    combination_group_id?: number | string
    npc?: Record<
      string,
      {
        master?: {
          id?: string | number
          character_id?: string | number
          name?: string
          [key: string]: unknown
        } | null
        is_fix_evoker_npc?: boolean
        [key: string]: unknown
      } | null
    >
    pc?: Record<string, unknown>
    [key: string]: unknown
  }
  bullet_info?: unknown
}

/** The chrome.storage entry for one deck. Never holds the request URL. */
export interface SolomonisDeckCacheEntry {
  data: SolomonisDeck
  timestamp: number
  priority: string
  deckName: string | null
  /** The route Evoker (see `deckEvoker`) */
  evokerId: string | null
  evokerName: string | null
}

/**
 * The deck sent with a report as `current_setup`, which fills in the
 * weapons and summons the report leaves out.
 */
export type SolomonisCurrentSetup = SolomonisDeck

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
  /** Resend after a duplicate_report conflict to update the existing party */
  updateExisting?: boolean
  currentSetup?: SolomonisCurrentSetup | null
}

/** POST /import body for an Evoker's party deck. */
export interface SolomonisPartyImportBody {
  kind: 'solomonis_party'
  name?: string
  visibility?: number
  playlist_ids: string[]
  solomonis: { deck: SolomonisDeck }
}

export interface SolomonisPartyImportOptions {
  name?: string
  visibility?: number
  playlistIds?: string[]
  shareWithCrew?: boolean
}
