/**
 * Parser for the GBF profile support-summon block.
 *
 * The XHR at /profile/content/index/<uid> returns
 *   { "data": "<URL-encoded HTML>" }
 * and the support-summon slots live in that HTML, not in a structured field.
 *
 * Each populated slot is an element with:
 *   id="js-fix-summon{S}{P}"        // S = GBF section index (0=Misc,1=Fire,...,6=Dark)
 *                                    // P = position within the section
 *   data-masterid="2040094000"       // The summon's granblue_id
 *
 * and a sibling element:
 *   id="js-fix-summon{S}{P}-name" ... >Lvl <N> <Name></div>   (EN; the JP client uses "Lv")
 *
 * Empty slots have no js-fix-summon id and link to profile/fix/list/summon/{S}/{P}.
 * Both of those are edit ("fix") affordances, which only appear when the
 * player is viewing their own profile. Section indices use GBF's ordering;
 * translation to our internal enum happens server-side in
 * SupportSummonImportService.
 */

export interface ParsedSupportSummon {
  /** GBF section index, 0=Misc, 1=Fire, 2=Water, 3=Earth, 4=Wind, 5=Light, 6=Dark */
  gbf_section: number
  /** Position within the section (0-2 for elements, 0-3 for misc) */
  position: number
  /** The summon's granblue_id (data-masterid) */
  granblue_id: string
  /** In-game level, or null when the label couldn't be read */
  level: number | null
  /** Display name from the slot label, when present */
  name: string | null
}

export interface ParsedSupportSummonPayload {
  /** GBF account user_id parsed from the request URL */
  gbf_user_id: string | null
  /**
   * Whether the page had the edit ("fix") controls that only show on the
   * player's own profile. Another player's profile must never be imported
   * over the user's support summons.
   */
  is_own_profile: boolean
  /** Populated slots, omitting empty ones */
  items: ParsedSupportSummon[]
}

const SLOT_TAG_RE = /<[^>]*\bid="js-fix-summon(\d)(\d)"[^>]*>/g
const MASTER_ID_RE = /\bdata-masterid="(\d+)"/
const NAME_RE = /<[^>]*\bid="js-fix-summon(\d)(\d)-name"[^>]*>([^<]*)</g
const LEVEL_LABEL_RE = /^\s*Lv(?:l)?\.?\s*(\d+)\s*(.*?)\s*$/i
const EDIT_MARKUP_RE = /js-fix-summon\d\d|profile\/fix\/list\/summon\//
const URL_USER_ID_RE = /\/profile\/content\/index\/(\d+)/

export function extractGbfUserIdFromUrl(url: string): string | null {
  const match = URL_USER_ID_RE.exec(url)
  return match ? match[1]! : null
}

/**
 * Parse the URL-encoded HTML returned by /profile/content/index/<uid>.
 *
 * @param rawData The JSON envelope from the XHR — expects `{ data: "..." }`
 *                where `data` is a URL-encoded HTML string.
 * @param url The request URL (used to extract the GBF user_id)
 */
export function parseSupportSummons(
  rawData: unknown,
  url: string
): ParsedSupportSummonPayload {
  const empty: ParsedSupportSummonPayload = {
    gbf_user_id: extractGbfUserIdFromUrl(url),
    is_own_profile: false,
    items: []
  }

  const encoded = (rawData as { data?: unknown } | null)?.data
  if (typeof encoded !== 'string' || encoded.length === 0) return empty

  let html: string
  try {
    html = decodeURIComponent(encoded)
  } catch {
    return empty
  }

  const slots = new Map<string, ParsedSupportSummon>()

  for (const match of html.matchAll(SLOT_TAG_RE)) {
    const masterId = MASTER_ID_RE.exec(match[0])?.[1]
    if (!masterId) continue
    slots.set(`${match[1]}${match[2]}`, {
      gbf_section: parseInt(match[1]!, 10),
      position: parseInt(match[2]!, 10),
      granblue_id: masterId,
      level: null,
      name: null
    })
  }

  for (const match of html.matchAll(NAME_RE)) {
    const slot = slots.get(`${match[1]}${match[2]}`)
    const label = LEVEL_LABEL_RE.exec(match[3]!)
    if (!slot || !label) continue
    slot.level = parseInt(label[1]!, 10)
    slot.name = label[2] || null
  }

  const items = Array.from(slots.values()).sort(
    (a, b) => a.gbf_section - b.gbf_section || a.position - b.position
  )

  return {
    gbf_user_id: empty.gbf_user_id,
    is_own_profile: EDIT_MARKUP_RE.test(html),
    items
  }
}
