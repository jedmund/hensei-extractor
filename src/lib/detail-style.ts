/**
 * Style shifts on archive character pages.
 *
 * A character with a style shift (e.g. Cidala / Super Cidala) has one
 * archive page per style. Both `/archive/npc_detail` responses carry the
 * same `id`; the style is the top-level `style` key (1 or 2), and
 * `style_list` names each style and its image. Style 1, or a payload with
 * no style, keeps the plain `<id>` cache suffix so existing caches still
 * resolve; other styles get `<id>_style<n>`.
 */

interface StyleListEntry {
  name?: string
  image?: string
  style?: number | string
}

const STYLE_SUFFIX = /^(.+)_style(\d+)$/

/** The captured style of an npc_detail payload; 1 when missing or invalid */
export function npcStyleOf(data: unknown): number {
  const style = Number((data as { style?: unknown } | null)?.style)
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

/** Cache key / dataType suffix for a detail capture: `<id>` or `<id>_style<n>` */
export function detailCacheSuffix(
  dataType: string,
  granblueId: string,
  data: unknown
): string {
  if (dataType !== 'detail_npc') return granblueId
  const style = npcStyleOf(data)
  return style > 1 ? `${granblueId}_style${style}` : granblueId
}

/** Splits a detail cache suffix back into its granblue ID and style */
export function parseDetailSuffix(suffix: string): {
  granblueId: string
  style: number
} {
  const match = STYLE_SUFFIX.exec(suffix)
  if (!match) return { granblueId: suffix, style: 1 }
  return { granblueId: match[1]!, style: Number(match[2]) }
}
