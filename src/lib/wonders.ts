/**
 * The game's Wonders page (`GET /item/memorial_list/1`): a list of
 * categories, each with its Wonders. Only the fields the extension reads
 * are typed; the import sends the page as it was received.
 */

export interface WonderItem {
  item_id: string
  image?: string
  name?: string
  /** "1" when the Wonder is on, "0" when it's off */
  set_flg?: string
  /** Only on Seals, Yupei and the "Other" category */
  level?: string | number
  max_level?: string | number
  [key: string]: unknown
}

export interface WonderCategory {
  /** Sometimes a number */
  category_id: string | number
  name?: string
  item?: WonderItem[]
  [key: string]: unknown
}

/** How many Wonders a captured page holds, across every category. */
export function countWonders(data: unknown[]): number {
  return data.reduce<number>((total, category) => {
    const items = (category as { item?: unknown } | null)?.item
    return total + (Array.isArray(items) ? items.length : 0)
  }, 0)
}

/** Whether the player has a Wonder turned on. */
export function isWonderActive(item: WonderItem): boolean {
  return String(item.set_flg) !== '0'
}

/** Levels are shown only for Wonders that level up (Seals and Yupei). */
export function wonderLevel(item: WonderItem): number | null {
  return Number(item.max_level) > 1 && item.level != null
    ? Number(item.level)
    : null
}
