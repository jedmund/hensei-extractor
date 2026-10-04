/**
 * Decisions behind DetailView's loading: which lookups a data type needs,
 * how the responses are turned into view state, how collection items are
 * sectioned and ticked, and which raid a captured party suggests.
 * The component owns the state and the requests; these are pure.
 */

import * as m from '../paraglide/messages.js'
import {
  getOwnershipId,
  isCollectionType,
  isLevel1,
  isWeaponOrSummonCollection,
  toArray,
  type RawGameItem
} from './detail-helpers.js'
import type {
  CollectionIdsResponse,
  CollectionUpdate,
  RaidEntry,
  RaidGroup
} from './types/messages.js'

export interface PartyDeckData {
  deck?: {
    pc?: {
      weapons?: Record<string, unknown>
      summons?: Record<string, unknown>
      sub_summons?: Record<string, unknown>
      damage_info?: { summon_name?: string }
      set_action?: Array<{ name: string }>
      [key: string]: unknown
    }
    npc?: Record<string, unknown>
    name?: string
    [key: string]: unknown
  }
  bullet_info?: { set_bullets?: Record<string, unknown> }
  [key: string]: unknown
}

export function isPartyType(dataType: string): boolean {
  return dataType.startsWith('party_')
}

export function isWeaponType(dataType: string): boolean {
  return dataType.includes('weapon') || dataType.startsWith('stash_weapon')
}

/** Which lookups loadDetailData runs after the cached data for `dataType`. */
export interface DetailLoadPlan {
  /** Owned ids and pending updates, to section a collection */
  ownership: boolean
  /** Pending updates for captured character stats */
  characterStatsUpdates: boolean
  /** Support summon, weapon keys, job skills and stat modifiers */
  partySupplementary: boolean
  /** Stat modifier names for AX tooltips */
  weaponStatModifiers: boolean
  /** Party name and raid suggestion */
  raidSuggestion: boolean
}

export function detailLoadPlan(dataType: string): DetailLoadPlan {
  const ownership = isCollectionType(dataType) && dataType !== 'character_stats'
  return {
    ownership,
    characterStatsUpdates: dataType === 'character_stats',
    partySupplementary: isPartyType(dataType),
    weaponStatModifiers: isWeaponType(dataType),
    raidSuggestion: isPartyType(dataType)
  }
}

/** The owned ids that apply to `dataType`, empty if the lookup failed. */
export function ownedIdsFor(
  dataType: string,
  response: CollectionIdsResponse
): Set<string> {
  if (response.error) return new Set()
  if (isWeaponType(dataType)) {
    return new Set(response.weapons || [])
  } else if (
    dataType.includes('summon') ||
    dataType.startsWith('stash_summon')
  ) {
    return new Set(response.summons || [])
  } else if (dataType.includes('artifact')) {
    return new Set(response.artifacts || [])
  } else if (dataType.includes('npc') || dataType.includes('character')) {
    return new Set(response.characters || [])
  }
  return new Set()
}

/** Collection updates keyed by game_id, falling back to granblue_id. */
export function collectionUpdatesByKey(
  updates: CollectionUpdate[]
): Map<string, CollectionUpdate> {
  const map = new Map<string, CollectionUpdate>()
  for (const update of updates) {
    const key = update.game_id ?? update.granblue_id
    if (key) map.set(key, update)
  }
  return map
}

/** Character stats updates keyed by granblue_id. */
export function characterStatsUpdatesByKey(
  updates: CollectionUpdate[]
): Map<string, CollectionUpdate> {
  const map = new Map<string, CollectionUpdate>()
  for (const update of updates) {
    const key = update.granblue_id
    if (key) map.set(key, update)
  }
  return map
}

/** What to look up for a party's support summon and job skills. */
export function partyLookups(data: PartyDeckData | undefined): {
  summonName: string | undefined
  skillNames: string[]
} {
  const summonName = data?.deck?.pc?.damage_info?.summon_name
  const setAction = data?.deck?.pc?.set_action || []
  const skillNames = setAction.map((s) => s.name).filter(Boolean)
  return { summonName, skillNames }
}

export function countPartyMembers(data: PartyDeckData | undefined): {
  weapons: number
  characters: number
} {
  const deck = data?.deck
  return {
    weapons: toArray(deck?.pc?.weapons).filter(Boolean).length,
    characters: toArray(deck?.npc).filter(Boolean).length
  }
}

/**
 * The raid a party's size suggests: a full Versusia grid, an EX+ farming
 * grid, or any other five-character party for farming.
 */
export function suggestedRaidSlug(
  weaponCount: number,
  characterCount: number
): string | null {
  if (weaponCount === 13 && characterCount === 8) return 'versusia'
  if (weaponCount === 13 && characterCount === 5) return 'farming-ex'
  if (characterCount === 5) return 'farming'
  return null
}

export function findRaidBySlug(
  groups: RaidGroup[],
  slug: string
): (RaidEntry & { group: RaidGroup }) | null {
  for (const group of groups) {
    const raid = (group.raids || []).find((r) => r.slug === slug)
    if (raid) return { ...raid, group }
  }
  return null
}

export type ItemEntry = { item: RawGameItem; originalIndex: number }

export interface CategorySection {
  key: string
  label: string
  items: ItemEntry[]
  defaultExpanded: boolean
}

/**
 * Splits collection items into new, updated, unchanged and (for weapons and
 * summons) level 1 sections, leaving out empty ones.
 */
export function categorizeItems(
  dataType: string,
  items: ItemEntry[],
  ownedIds: Set<string>,
  collectionUpdates: Map<string, CollectionUpdate>
): CategorySection[] {
  const willImport: ItemEntry[] = []
  const hasUpdates: ItemEntry[] = []
  const unchanged: ItemEntry[] = []
  const level1: ItemEntry[] = []

  const showLv1Section = isWeaponOrSummonCollection(dataType)

  for (const entry of items) {
    const ownershipId = getOwnershipId(dataType, entry.item)
    if (showLv1Section && isLevel1(entry.item)) {
      level1.push(entry)
    } else if (ownershipId && ownedIds.has(ownershipId)) {
      if (ownershipId && collectionUpdates.has(ownershipId)) {
        hasUpdates.push(entry)
      } else {
        unchanged.push(entry)
      }
    } else {
      willImport.push(entry)
    }
  }

  const sections: CategorySection[] = []
  if (willImport.length > 0) {
    sections.push({
      key: 'will_import',
      label: m.section_will_import(),
      items: willImport,
      defaultExpanded: true
    })
  }
  if (hasUpdates.length > 0) {
    sections.push({
      key: 'has_updates',
      label: m.section_has_updates(),
      items: hasUpdates,
      defaultExpanded: true
    })
  }
  if (unchanged.length > 0) {
    sections.push({
      key: 'unchanged',
      label: m.section_unchanged(),
      items: unchanged,
      defaultExpanded: willImport.length === 0 && hasUpdates.length === 0
    })
  }
  if (level1.length > 0) {
    sections.push({
      key: 'level_1',
      label: m.section_level_1(),
      items: level1,
      defaultExpanded: false
    })
  }
  return sections
}

/** Ticks new and updated items, except ones the user unticked. */
export function defaultSelection(
  sections: CategorySection[],
  manuallyUnchecked: Set<number>
): Set<number> {
  const next = new Set<number>()
  for (const section of sections) {
    if (section.key !== 'will_import' && section.key !== 'has_updates') continue
    for (const { originalIndex } of section.items) {
      if (!manuallyUnchecked.has(originalIndex)) {
        next.add(originalIndex)
      }
    }
  }
  return next
}
