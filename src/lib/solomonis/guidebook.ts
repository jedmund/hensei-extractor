/**
 * The guidebook log, grouped for the side panel: one section per rarity,
 * in the order the game lists them, each effect with its stack count.
 */

import type { SolomonisStatus } from './types.js'

export type GuidebookRarity = 'unique' | 'rare' | 'normal' | 'cursed'

/** The game's rarity numbers. */
const RARITIES: Record<number, GuidebookRarity> = {
  3: 'unique',
  2: 'rare',
  1: 'normal',
  99: 'cursed'
}

const ORDER: GuidebookRarity[] = ['unique', 'rare', 'normal', 'cursed']

export interface GuidebookEntry {
  statusId: number | null
  name: string
  count: number
}

export interface GuidebookSection {
  rarity: GuidebookRarity
  entries: GuidebookEntry[]
  /** Stacks held across the section's effects */
  stacks: number
}

/** An effect's text as the game shows it: `@@` marks a line break. */
export function guidebookEffectName(name: unknown): string {
  return typeof name === 'string' ? name.replaceAll('@@', '').trim() : ''
}

/**
 * Groups the log by rarity, keeping the game's order within each group.
 * Entries with an unknown rarity or no name are left out.
 */
export function guidebookSections(
  statusList: SolomonisStatus[] | null | undefined
): GuidebookSection[] {
  const groups = new Map<GuidebookRarity, GuidebookEntry[]>()
  for (const status of statusList ?? []) {
    const rarity = RARITIES[status.rarity ?? -1]
    const name = guidebookEffectName(status.name)
    if (!rarity || !name) continue
    const count = Number.isInteger(status.num) && status.num! > 0 ? status.num! : 1
    const entries = groups.get(rarity) ?? []
    entries.push({ statusId: status.status_id ?? null, name, count })
    groups.set(rarity, entries)
  }
  return ORDER.filter((rarity) => groups.has(rarity)).map((rarity) => {
    const entries = groups.get(rarity)!
    return {
      rarity,
      entries,
      stacks: entries.reduce((sum, entry) => sum + entry.count, 0)
    }
  })
}
