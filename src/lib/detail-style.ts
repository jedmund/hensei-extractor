/**
 * Style shifts on archive character pages.
 *
 * A character with a style shift (e.g. Cidala / Super Cidala) has one
 * archive page per style. Both `/archive/npc_detail` responses carry the
 * same `id`; the style is the top-level `style` key (1 or 2), and
 * `style_list` names each style and its image. The import queue keys
 * each style apart.
 */

interface StyleListEntry {
  name?: string
  image?: string
  style?: number | string
}

/**
 * The captured style of an npc_detail payload; 1 when missing or invalid.
 * Read from the top-level `style`, else `param.style`.
 */
export function npcStyleOf(data: unknown): number {
  const payload = data as {
    style?: unknown
    param?: { style?: unknown } | null
  } | null
  const style = Number(payload?.style ?? payload?.param?.style)
  return Number.isInteger(style) && style > 1 ? style : 1
}

/** The payload's `style_list` entry for its captured style */
export function npcStyleEntry(data: unknown): StyleListEntry | undefined {
  const list = (data as { style_list?: unknown } | null)?.style_list
  if (!Array.isArray(list)) return undefined
  const style = npcStyleOf(data)
  return (list as StyleListEntry[]).find(
    (entry) => Number(entry?.style) === style
  )
}

/** The style's own name (e.g. "Super Cidala"), only for styles after the first */
export function npcStyleName(data: unknown): string | undefined {
  if (npcStyleOf(data) === 1) return undefined
  const name = npcStyleEntry(data)?.name
  return typeof name === 'string' && name ? name : undefined
}
