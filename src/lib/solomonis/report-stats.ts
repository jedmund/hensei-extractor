/**
 * What the expedition log says about a run: the spaces it reached, its
 * shop and coin totals, and the allies at the end. Keys and order match
 * hensei-web's expedition stats (and the API's report parser).
 */

import type { SolomonisReport } from './types.js'

/** Spaces in the order the game's report lists them: combat, then the rest. */
export const SPACE_STAT_KEYS = [
  'battle',
  'strong',
  'terrifying',
  'ruler',
  'boss',
  'event',
  'healing',
  'chest',
  'teleporter',
  'special'
] as const

export type SpaceStatKey = (typeof SPACE_STAT_KEYS)[number]

const SPACE_FIELDS: Record<SpaceStatKey, string> = {
  battle: 'normal_enemy_count',
  strong: 'strong_enemy_count',
  terrifying: 'super_strong_enemy_count',
  ruler: 'guardian_count',
  boss: 'boss_count',
  event: 'incident_count',
  healing: 'recovery_count',
  chest: 'treasure_chest_count',
  teleporter: 'warp_count',
  special: 'special_count'
}

/** The game sends counts as numeric strings. */
function count(report: SolomonisReport, field: string): number | null {
  const value = report[field]
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

/** Spaces reached, in display order, skipping counts the report left out. */
export function reportSpaceStats(
  report: SolomonisReport
): { key: SpaceStatKey; count: number }[] {
  return SPACE_STAT_KEYS.flatMap((key) => {
    const value = count(report, SPACE_FIELDS[key])
    return value == null ? [] : [{ key, count: value }]
  })
}

/** Shop purchases and Sephira coins earned, when the report has them. */
export function reportEconomy(report: SolomonisReport): {
  shopPurchases: number | null
  pointsEarned: number | null
} {
  return {
    shopPurchases: count(report, 'shop_purchase_count'),
    pointsEarned: count(report, 'total_dungeon_point')
  }
}

/**
 * The five allies at the end of the run, Evoker included, as character
 * image IDs (`<granblue_id>_<art>[_<variant>]`). Order carries no meaning
 * in this mode.
 */
export function reportAllies(report: SolomonisReport | null | undefined): string[] {
  if (!report) return []
  return [1, 2, 3, 4, 5]
    .map((n) => report[`npc${n}_image_id`])
    .filter((id): id is string => typeof id === 'string' && /^\d+_\w+$/.test(id))
}
