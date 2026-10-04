/**
 * Pure utility functions for detail views.
 * Type checks, data extraction, image URL builders, and modifier data helpers.
 */

import { BUCKET, getImageUrl } from './constants.js'
import {
  WEAPON_AWAKENING_ICONS,
  WEAPON_KEY_SERIES,
  AUGMENT_ICON_MAP
} from './game-data.js'
import { getBaseGranblueIdForVariant } from './element-variants.js'
import { getImageIdSuffix, getSummonImageUrl } from './images.js'
import * as m from '../paraglide/messages.js'

// ==========================================
// RAW API ITEM SHAPES
// ==========================================

/** Fields accessed on master sub-objects across item types */
interface RawMaster {
  id?: string
  name?: string
  series_id?: string | number
  kind?: string | number
  attribute?: string | number
  rarity?: string | number
  element?: string | number
  specialty_weapon?: Array<string | number>
  comment?: string
  default_hp?: string | number
  default_attack?: string | number
  max_hp?: string | number
  max_attack?: string | number
  max_level?: string | number
  /** The game's weapon group id; MainView uses it to spot weapons that take keys */
  is_group?: string | number
}

/** AX / befoulment skill entry as returned by the API */
interface RawAugmentSkillEntry {
  image?: string
  show_value?: string
  [key: string]: unknown
}

/** Awakening (arousal) data nested in param */
interface RawArousal {
  form_id?: number
  form_name?: string
  level?: number
  is_arousal_weapon?: boolean
}

/** Befoulment (odiant) data nested in param */
interface RawOdiant {
  is_odiant_weapon?: boolean
  exorcision_level?: number
  max_exorcision_level?: number
}

/** Fields accessed on param sub-objects across item types */
interface RawParam {
  id?: string
  evolution?: number
  phase?: number
  style?: string
  image_id?: string
  level?: string | number
  hp?: string | number
  attack?: string | number
  has_npcaugment_constant?: boolean
  arousal?: RawArousal
  odiant?: RawOdiant
  augment_skill_info?: Array<Record<string, RawAugmentSkillEntry>>
  augment_skill_icon_image?: string[]
}

/** Weapon skill reference on top-level item */
interface RawWeaponSkillRef {
  id?: string
  [key: string]: unknown
}

/** A raw game item as received from the API, covering characters, weapons, summons */
export interface RawGameItem {
  id?: string
  master?: RawMaster
  param?: RawParam
  skill1?: RawWeaponSkillRef
  skill2?: RawWeaponSkillRef
  skill3?: RawWeaponSkillRef
  artifact_id?: string
  rarity?: string | number
  attribute?: string | number
  element?: string | number
  kind?: string | number
  weapon_kind?: string | number
  series_id?: string | number
  default_hp?: string | number
  default_attack?: string | number
  max_hp?: string | number
  max_attack?: string | number
  max_attack_2?: string | number
  comment?: string
  sub_skill?: { name?: string }
  [key: string]: unknown
}

/** Page shape within collection/list/stash responses */
interface CollectionPage {
  list?: RawGameItem[]
  [key: string]: unknown
}

/** Party data shape */
interface PartyData {
  deck?: {
    pc?: {
      weapons?: Record<string, RawGameItem | null> | RawGameItem[]
      summons?: Record<string, RawGameItem | null> | RawGameItem[]
      sub_summons?: Record<string, RawGameItem | null> | RawGameItem[]
      [key: string]: unknown
    }
    npc?: Record<string, RawGameItem | null> | RawGameItem[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

// ==========================================
// DATA TYPE HELPERS
// ==========================================

export function isCollectionType(dataType: string): boolean {
  return (
    dataType.startsWith('collection_') ||
    dataType.startsWith('list_') ||
    dataType.startsWith('stash_') ||
    dataType === 'character_stats'
  )
}

export function isDatabaseDetailType(dataType: string): boolean {
  return dataType.startsWith('detail_')
}

export function isCharacterCollection(dataType: string): boolean {
  return dataType === 'collection_npc' || dataType === 'list_npc'
}

export function isWeaponOrSummonCollection(dataType: string): boolean {
  return (
    dataType === 'collection_weapon' ||
    dataType === 'collection_summon' ||
    dataType === 'list_weapon' ||
    dataType === 'list_summon' ||
    dataType.startsWith('stash_weapon') ||
    dataType.startsWith('stash_summon')
  )
}

// ==========================================
// DATA EXTRACTION
// ==========================================

export function toArray(data: unknown): unknown[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object')
    return Object.values(data as Record<string, unknown>)
  return []
}

export function extractItems(
  dataType: string,
  data: Record<string, CollectionPage> | PartyData | RawGameItem
): RawGameItem[] {
  if (
    dataType.startsWith('collection_') ||
    dataType.startsWith('list_') ||
    dataType.startsWith('stash_')
  ) {
    const pages = Object.values(data as Record<string, CollectionPage>)
    return pages.flatMap((page) => page.list || [])
  }
  if (dataType.startsWith('party_')) {
    const partyData = data as PartyData
    const deck = partyData.deck || {}
    const pc = deck.pc || {}
    return [
      ...toArray(deck.npc),
      ...toArray(pc.weapons),
      ...toArray(pc.summons),
      ...toArray(pc.sub_summons)
    ].filter(Boolean) as RawGameItem[]
  }
  return [data as RawGameItem]
}

export function countItems(
  dataType: string,
  data: Record<string, CollectionPage> | PartyData | RawGameItem
): number {
  return extractItems(dataType, data).length
}

// ==========================================
// IMAGE & LABEL HELPERS
// ==========================================

function getCharacterPose(
  uncapLevel: number | undefined,
  transcendenceStep: number | undefined,
  simplePortraits: boolean
): string {
  if (transcendenceStep && transcendenceStep > 0) return '_04'
  if (uncapLevel && uncapLevel >= 5) return '_03'
  if (uncapLevel && uncapLevel > 2) return simplePortraits ? '_01' : '_02'
  return '_01'
}

function getCharacterImageSuffix(
  item: RawGameItem,
  simplePortraits: boolean
): string {
  if (item.param?.style === '2') return '_01_style'
  const evolution = item.param?.evolution
  const phase = item.param?.phase
  return getCharacterPose(evolution, phase, simplePortraits)
}

function getImageSuffix(item: RawGameItem): string {
  return getImageIdSuffix(
    item.master?.id || item.param?.id || item.id,
    item.param?.image_id
  )
}

export function getItemImageUrl(
  dataType: string,
  item: RawGameItem,
  simplePortraits: boolean
): string {
  const granblueId = item.master?.id || item.param?.id || item.id

  if (dataType.includes('npc') || dataType.includes('character')) {
    const suffix = getCharacterImageSuffix(item, simplePortraits)
    return getImageUrl(`${BUCKET.characterSquare}/${granblueId}${suffix}.jpg`)
  }
  if (dataType.includes('weapon')) {
    const suffix = getImageSuffix(item)
    return getImageUrl(`${BUCKET.weaponSquare}/${granblueId}${suffix}.jpg`)
  }
  if (dataType.includes('summon')) {
    return getSummonImageUrl(granblueId, 'square', item.param?.image_id)
  }
  if (dataType.includes('artifact')) {
    const artifactId = item.artifact_id || granblueId
    return getImageUrl(`${BUCKET.artifactSquare}/${artifactId}.jpg`)
  }
  return ''
}

/**
 * Returns a fallback image URL for an item whose primary thumbnail may 404.
 * Currently only meaningful for element-changeable weapons (Ultima, Atma, CCW,
 * Superlative): the game sends per-element variant IDs whose thumbnails aren't
 * uploaded to the S3 bucket. Falling back to the base granblue_id image gives
 * a generic but present thumbnail so the weapon stays visible and importable.
 */
export async function getItemImageFallbackUrl(
  dataType: string,
  item: RawGameItem
): Promise<string | undefined> {
  if (!(dataType.includes('weapon') || dataType.startsWith('stash_weapon'))) {
    return undefined
  }
  const granblueId = item.master?.id || item.param?.id || item.id
  if (!granblueId) return undefined
  const baseId = await getBaseGranblueIdForVariant(String(granblueId))
  if (!baseId) return undefined
  return getImageUrl(`${BUCKET.weaponSquare}/${baseId}.jpg`)
}

export function getOwnershipId(dataType: string, item: RawGameItem): string {
  if (dataType.includes('npc') || dataType.includes('character'))
    return item.master?.id?.toString() || ''
  if (dataType.includes('artifact')) return item.id?.toString() || ''
  return item.param?.id?.toString() || ''
}

export function isLevel1(item: RawGameItem): boolean {
  const level =
    item.param?.level || item.level || (item as Record<string, unknown>).lv
  return level === 1 || level === '1'
}

export function getGridClass(dataType: string): string {
  if (dataType.includes('artifact')) return 'artifacts'
  if (dataType.includes('npc') || dataType.includes('character'))
    return 'characters'
  if (dataType.includes('weapon')) return 'weapons'
  if (dataType.includes('summon')) return 'summons'
  return ''
}

// ==========================================
// MODIFIER DATA HELPERS
// ==========================================

export interface CharacterModifiers {
  perpetuity: boolean
}

export function getCharacterModifiers(item: RawGameItem): CharacterModifiers {
  const param = item.param || {}
  return {
    perpetuity: !!param.has_npcaugment_constant
  }
}

export interface WeaponModifiers {
  awakening: {
    form_name: string
    level: number
    is_arousal_weapon: boolean
  } | null
  axSkill: {
    skill: Record<string, RawAugmentSkillEntry>
    iconImage: string | null
  } | null
  befoulment: {
    skill: Record<string, RawAugmentSkillEntry> | null
    exorcismLevel: number
    maxExorcismLevel: number
    iconImage: string | null
  } | null
  weaponKeys: { slug: string; name: string }[]
}

export function getWeaponModifiers(
  item: RawGameItem,
  weaponKeyMap: Record<string, { slug: string; name: string }> | null = null
): WeaponModifiers {
  const param = item.param ?? ({} as RawParam)
  const odiant = param.odiant ?? ({} as RawOdiant)
  const isOdiant = odiant.is_odiant_weapon === true

  const weaponKeys: { slug: string; name: string }[] = []
  if (weaponKeyMap) {
    const seriesId = parseInt(String(item.master?.series_id))
    if (WEAPON_KEY_SERIES.has(seriesId)) {
      const weaponProficiency = parseInt(String(item.master?.kind)) || null
      for (const skillKey of ['skill1', 'skill2', 'skill3'] as const) {
        const skillRef = item[skillKey] as RawWeaponSkillRef | undefined
        const skillId = skillRef?.id
        if (skillId && weaponKeyMap[skillId]) {
          const entry = weaponKeyMap[skillId]
          const GAUPH_SLOT0 = [
            'gauph-courage',
            'gauph-strength',
            'gauph-strife',
            'gauph-vitality',
            'gauph-will',
            'gauph-zeal'
          ]
          const needsSuffix =
            GAUPH_SLOT0.includes(entry.slug) && weaponProficiency
          weaponKeys.push({
            slug: needsSuffix
              ? `${entry.slug}-${weaponProficiency}`
              : entry.slug,
            name: entry.name
          })
        }
      }
    }
  }

  return {
    awakening:
      param.arousal?.is_arousal_weapon &&
      param.arousal?.form_name &&
      param.arousal?.level
        ? {
            form_name: param.arousal.form_name,
            level: param.arousal.level,
            is_arousal_weapon: param.arousal.is_arousal_weapon!
          }
        : null,
    axSkill:
      !isOdiant && param.augment_skill_info?.[0]
        ? {
            skill: param.augment_skill_info[0]!,
            iconImage: param.augment_skill_icon_image?.[0] || null
          }
        : null,
    befoulment: isOdiant
      ? {
          skill:
            (param.augment_skill_info?.[0] as
              | Record<string, RawAugmentSkillEntry>
              | undefined) ?? null,
          exorcismLevel: odiant.exorcision_level || 0,
          maxExorcismLevel: odiant.max_exorcision_level || 5,
          iconImage: param.augment_skill_icon_image?.[0] || null
        }
      : null,
    weaponKeys
  }
}

/** Resolve the AX skill icon filename from AUGMENT_ICON_MAP */
export function resolveAugmentIcon(slug: string): string {
  return AUGMENT_ICON_MAP[slug] || slug
}

/** Resolve the awakening icon filename from WEAPON_AWAKENING_ICONS */
export function resolveAwakeningIcon(formName: string): string {
  return WEAPON_AWAKENING_ICONS[formName] || 'weapon-atk'
}

/** Modifier name entry used for AX skill tooltip lookup */
export interface WeaponStatModifier {
  nameEn?: string
  nameJp?: string
  [key: string]: unknown
}

/** Build an AX skill tooltip from skill entries */
export function buildAxTooltipLines(
  skill: Record<string, RawAugmentSkillEntry> | null,
  iconImage: string | null,
  weaponStatModifiers: Record<string, WeaponStatModifier> | null,
  locale: string
): string[] {
  const iconSlug = iconImage || 'ex_skill_atk'
  const axEntries = Object.values(skill || {})
  if (axEntries.length === 0) return [m.stat_ax_skills()]
  return axEntries
    .map((s: RawAugmentSkillEntry) => {
      const entryIconSlug = s.image || iconSlug
      const entryFile = AUGMENT_ICON_MAP[entryIconSlug] || entryIconSlug
      const mod = weaponStatModifiers?.[entryFile]
      const name = mod ? (locale === 'ja' ? mod.nameJp : mod.nameEn) : ''
      const value = s.show_value || ''
      return name && value ? `${name} ${value}` : name || value
    })
    .filter((l): l is string => !!l)
}

/**
 * Alt-art suffixes to try, best first, for a summon shown at its max uncap
 * (the API imports a party's support summon that way, since the party only
 * names it). Which alt art exists varies by summon, so callers step down
 * the list when an image fails to load; '' (base art) always exists.
 */
export function maxEvolutionArtSuffixes(uncap?: {
  flb?: boolean
  ulb?: boolean
  transcendence?: boolean
}): string[] {
  if (uncap?.transcendence) return ['_04', '_03', '_02', '']
  if (uncap?.ulb || uncap?.flb) return ['_02', '']
  return ['']
}
