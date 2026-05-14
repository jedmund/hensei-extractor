/**
 * Parser for the GBF profile support-summon block.
 *
 * The XHR at /profile/content/index/<uid> returns
 *   { "data": "<URL-encoded HTML>" }
 * and the support-summon slots live in that HTML, not in a structured field.
 *
 * Each populated slot is a div with:
 *   id="js-fix-summon{S}{P}"        // S = GBF section index (0=Misc,1=Fire,...,6=Dark)
 *                                    // P = position within the section
 *   data-masterid="2040094000"       // The summon's granblue_id
 *   data-quality="..."               // +N transcendence stat (ignored — we derive from level)
 *
 * and a sibling div:
 *   id="js-fix-summon{S}{P}-name" ... >Lvl <N> <Name></div>
 *
 * Empty slots have no js-fix-summon id and link to profile/fix/list/summon/{S}/{P}.
 *
 * Section indices use GBF's ordering. Translation to our internal enum happens
 * server-side in SupportSummonImportService.
 */

export interface ParsedSupportSummon {
  /** GBF section index, 0=Misc, 1=Fire, 2=Water, 3=Earth, 4=Wind, 5=Light, 6=Dark */
  gbf_section: number
  /** Position within the section (0-2 for elements, 0-3 for misc) */
  position: number
  /** The summon's granblue_id (data-masterid) */
  granblue_id: string
  /** In-game level — used to derive uncap_level and transcendence_step on import */
  level: number
}

export interface ParsedSupportSummonPayload {
  /** GBF account user_id parsed from the request URL */
  gbf_user_id: string | null
  /** Populated slots, omitting empty ones */
  items: ParsedSupportSummon[]
}

const SLOT_RE = /id="js-fix-summon(\d)(\d)"[^>]*data-masterid="(\d+)"/g
const NAME_RE = /id="js-fix-summon(\d)(\d)-name"[^>]*>Lvl\s+(\d+)/g
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
  const envelope = rawData as { data?: string } | null
  const encoded = envelope?.data
  if (typeof encoded !== 'string' || encoded.length === 0) {
    return { gbf_user_id: extractGbfUserIdFromUrl(url), items: [] }
  }

  let html: string
  try {
    html = decodeURIComponent(encoded)
  } catch {
    return { gbf_user_id: extractGbfUserIdFromUrl(url), items: [] }
  }

  const slots = new Map<string, ParsedSupportSummon>()

  SLOT_RE.lastIndex = 0
  for (
    let match = SLOT_RE.exec(html);
    match !== null;
    match = SLOT_RE.exec(html)
  ) {
    const section = parseInt(match[1]!, 10)
    const position = parseInt(match[2]!, 10)
    const granblueId = match[3]!
    slots.set(`${section}${position}`, {
      gbf_section: section,
      position,
      granblue_id: granblueId,
      level: 0
    })
  }

  NAME_RE.lastIndex = 0
  for (
    let match = NAME_RE.exec(html);
    match !== null;
    match = NAME_RE.exec(html)
  ) {
    const key = `${match[1]}${match[2]}`
    const slot = slots.get(key)
    if (slot) {
      slot.level = parseInt(match[3]!, 10)
    }
  }

  const items = Array.from(slots.values()).sort((a, b) => {
    if (a.gbf_section !== b.gbf_section) return a.gbf_section - b.gbf_section
    return a.position - b.position
  })

  return {
    gbf_user_id: extractGbfUserIdFromUrl(url),
    items
  }
}
