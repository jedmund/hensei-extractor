/**
 * Decisions behind the detail views: which view a data type gets, how
 * lookup responses are turned into view state, how collection items are
 * filtered, sectioned and ticked, and which raid a captured party suggests.
 * The components own the state and the requests; these are pure.
 */

import * as m from '../paraglide/messages.js'
import {
  getOwnershipId,
  isCharacterCollection,
  isCollectionType,
  isDatabaseDetailType,
  isLevel1,
  isWeaponOrSummonCollection,
  toArray,
  type RawGameItem
} from './detail-helpers.js'
import type {
  CollectionIdsResponse,
  CollectionUpdate,
  FetchRaidGroupsResponse,
  RaidEntry,
  RaidGroup
} from './types/messages.js'
import type { RaidSelection } from './state/app.svelte.js'

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

export function isWeaponType(dataType: string): boolean {
  return dataType.includes('weapon') || dataType.startsWith('stash_weapon')
}

/** Which child view DetailView shows for a data type. */
export type DetailViewKind =
  | 'crewScores'
  | 'party'
  | 'database'
  | 'characterStats'
  | 'supportSummons'
  | 'collection'
  | 'other'

export function detailViewKind(dataType: string): DetailViewKind {
  if (
    dataType.startsWith('unf_scores_') ||
    dataType.startsWith('unf_daily_scores_')
  ) {
    return 'crewScores'
  }
  if (dataType.startsWith('party_')) return 'party'
  if (isDatabaseDetailType(dataType)) return 'database'
  if (dataType === 'character_stats') return 'characterStats'
  if (dataType === 'support_summons') return 'supportSummons'
  if (isCollectionType(dataType)) return 'collection'
  return 'other'
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

/** The parts of the app state a raid suggestion reads and writes. */
export interface RaidSuggestionTarget {
  selectedRaid: RaidSelection | null
  /** Bumped whenever the user picks or clears a raid by hand */
  manualRaidSelections: number
}

/**
 * Selects the raid a party's size suggests, once the raid list has loaded.
 * Skipped if the load is stale, or if the user picked or cleared a raid by
 * hand since `manualSelectionsAtStart` was read at the start of the load.
 */
export async function applySuggestedRaid(options: {
  target: RaidSuggestionTarget
  manualSelectionsAtStart: number
  weapons: number
  characters: number
  loadRaidGroups: () => Promise<FetchRaidGroupsResponse>
  current: () => boolean
}): Promise<void> {
  const { target, weapons, characters } = options
  const response = await options.loadRaidGroups()
  if (!options.current() || response.error || !response.data) return
  if (target.manualRaidSelections !== options.manualSelectionsAtStart) return

  const slug = suggestedRaidSlug(weapons, characters)
  const suggested = slug ? findRaidBySlug(response.data, slug) : null
  if (suggested) target.selectedRaid = suggested
}

export type ItemEntry = { item: RawGameItem; originalIndex: number }

/**
 * Pairs items with their capture index, keeping weapons, summons and
 * characters whose rarity passes the filter. Level 1 items stay; they get
 * their own section.
 */
export function filterByRarity(
  dataType: string,
  items: RawGameItem[],
  activeRarityFilters: Set<string>
): ItemEntry[] {
  const byRarity =
    isWeaponOrSummonCollection(dataType) || isCharacterCollection(dataType)
  return items
    .map((item, index) => ({ item, originalIndex: index }))
    .filter(({ item }) => {
      if (byRarity) {
        const rarity =
          item.master?.rarity?.toString() || item.rarity?.toString()
        if (rarity && !activeRarityFilters.has(rarity)) return false
      }
      return true
    })
}

/** Named items are shown as a list, unnamed ones as a grid. */
export function hasItemNames(entries: ItemEntry[]): boolean {
  return entries.some(({ item }) => item.name || item.master?.name)
}

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
