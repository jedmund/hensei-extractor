/**
 * Pure utility functions for detail views.
 * Type checks, data extraction, image URL builders, and modifier data helpers.
 */

import { getImageUrl } from './constants.js'
import {
  GAME_ELEMENT_NAMES,
  GAME_PROFICIENCY_NAMES,
  GAME_CHARACTER_SERIES_NAMES,
  GAME_WEAPON_SERIES_NAMES,
  GAME_SUMMON_SERIES_NAMES,
  WEAPON_AWAKENING_ICONS,
  WEAPON_KEY_SERIES,
  AUGMENT_ICON_MAP,
  resolveForgedSummonId
} from './game-data.js'
import * as m from '../paraglide/messages.js'
import { translateSeries, getLocale } from './i18n.js'

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
  const imageId = item.param?.image_id
  if (!imageId) return ''

  const id = item.master?.id || item.param?.id || item.id
  if (!id || !imageId.startsWith(String(id))) return ''

  return imageId.slice(String(id).length)
}

export function getItemImageUrl(
  dataType: string,
  item: RawGameItem,
  simplePortraits: boolean
): string {
  const granblueId = item.master?.id || item.param?.id || item.id

  if (dataType.includes('npc') || dataType.includes('character')) {
    const suffix = getCharacterImageSuffix(item, simplePortraits)
    return getImageUrl(`character-square/${granblueId}${suffix}.jpg`)
  }
  if (dataType.includes('weapon')) {
    const suffix = getImageSuffix(item)
    return getImageUrl(`weapon-square/${granblueId}${suffix}.jpg`)
  }
  if (dataType.includes('summon')) {
    const suffix = getImageSuffix(item)
    const resolvedId = resolveForgedSummonId(granblueId ?? '')
    return getImageUrl(`summon-square/${resolvedId}${suffix}.jpg`)
  }
  if (dataType.includes('artifact')) {
    const artifactId = item.artifact_id || granblueId
    return getImageUrl(`artifact-square/${artifactId}.jpg`)
  }
  return ''
}

export function getArtifactLabels(item: RawGameItem): string {
  const element = item.attribute || item.element
  const proficiency = item.kind || item.weapon_kind

  let html = '<div class="list-item-labels">'

  if (
    element &&
    GAME_ELEMENT_NAMES[element as keyof typeof GAME_ELEMENT_NAMES]
  ) {
    html += `<img class="label-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element as keyof typeof GAME_ELEMENT_NAMES]}.png`)}" alt="">`
  }

  if (proficiency && GAME_PROFICIENCY_NAMES[Number(proficiency)]) {
    html += `<img class="label-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[Number(proficiency)]}.png`)}" alt="">`
  }

  html += '</div>'
  return html
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
  weaponKeys: string[]
}

export function getWeaponModifiers(
  item: RawGameItem,
  weaponKeyMap: Record<string, string> | null = null
): WeaponModifiers {
  const param = item.param ?? ({} as RawParam)
  const odiant = param.odiant ?? ({} as RawOdiant)
  const isOdiant = odiant.is_odiant_weapon === true

  const weaponKeys: string[] = []
  if (weaponKeyMap) {
    const seriesId = parseInt(String(item.master?.series_id))
    if (WEAPON_KEY_SERIES.has(seriesId)) {
      const weaponProficiency = parseInt(String(item.master?.kind)) || null
      for (const skillKey of ['skill1', 'skill2', 'skill3'] as const) {
        const skillRef = item[skillKey] as RawWeaponSkillRef | undefined
        const skillId = skillRef?.id
        if (skillId && weaponKeyMap[skillId]) {
          const slug = weaponKeyMap[skillId]
          const GAUPH_SLOT0 = [
            'gauph-courage',
            'gauph-strength',
            'gauph-strife',
            'gauph-vitality',
            'gauph-will',
            'gauph-zeal'
          ]
          const needsSuffix = GAUPH_SLOT0.includes(slug) && weaponProficiency
          weaponKeys.push(needsSuffix ? `${slug}-${weaponProficiency}` : slug)
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
export function buildAxTooltip(
  skill: Record<string, RawAugmentSkillEntry> | null,
  iconImage: string | null,
  weaponStatModifiers: Record<string, WeaponStatModifier> | null,
  locale: string
): string {
  const iconSlug = iconImage || 'ex_skill_atk'
  const axEntries = Object.values(skill || {})
  if (axEntries.length === 0) return m.stat_ax_skills()
  return axEntries
    .map((s: RawAugmentSkillEntry) => {
      const entryIconSlug = s.image || iconSlug
      const entryFile = AUGMENT_ICON_MAP[entryIconSlug] || entryIconSlug
      const mod = weaponStatModifiers?.[entryFile]
      const name = mod ? (locale === 'ja' ? mod.nameJp : mod.nameEn) : ''
      const value = s.show_value || ''
      return name && value ? `${name} ${value}` : name || value
    })
    .filter(Boolean)
    .map((l: string) => `<div>${l}</div>`)
    .join('')
}

// ==========================================
// STAT RENDERING (for DatabaseDetail)
// ==========================================

function statRow(label: string, value: string): string {
  return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`
}

const STAR_CONFIGS: Record<
  string,
  { base: number; tiers: Array<{ level: number; cls: string }> }
> = {
  character: {
    base: 4,
    tiers: [
      { level: 100, cls: 'flb' },
      { level: 150, cls: 'ulb' }
    ]
  },
  weapon: {
    base: 3,
    tiers: [
      { level: 150, cls: 'flb' },
      { level: 200, cls: 'flb' },
      { level: 250, cls: 'ulb' }
    ]
  },
  summon: {
    base: 3,
    tiers: [
      { level: 150, cls: 'flb' },
      { level: 200, cls: 'flb' },
      { level: 250, cls: 'ulb' }
    ]
  }
}

export function renderStars(maxLevel: number, type: string): string {
  const config = STAR_CONFIGS[type]
  if (!config) return ''
  let html = '<span class="stars">'
  for (let i = 0; i < config.base; i++)
    html += '<span class="star filled"></span>'
  for (const tier of config.tiers) {
    if (maxLevel >= tier.level) html += `<span class="star ${tier.cls}"></span>`
  }
  html += '</span>'
  return html
}

function renderBaseStats({
  data,
  name,
  id,
  seriesMap,
  element,
  proficiencies,
  type
}: {
  data: RawGameItem
  name: string
  id: string
  seriesMap?: Record<number, string>
  element?: string | number
  proficiencies?: Array<string | number>
  type: 'weapon' | 'summon' | 'character'
}) {
  const master = data.master ?? data
  const param = data.param ?? ({} as RawParam)

  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'
  html += statRow(m.stat_name(), name)
  if (id) html += statRow(m.stat_id(), id)

  const seriesId = Number(data.series_id || master.series_id)
  if (seriesId && seriesMap?.[seriesId]) {
    html += statRow(
      m.stat_series(),
      translateSeries(seriesMap[seriesId]!, type)
    )
  }

  if (
    element &&
    GAME_ELEMENT_NAMES[element as keyof typeof GAME_ELEMENT_NAMES]
  ) {
    html += statRow(
      m.stat_element(),
      `<img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element as keyof typeof GAME_ELEMENT_NAMES]}.png`)}" alt="${GAME_ELEMENT_NAMES[element as keyof typeof GAME_ELEMENT_NAMES]}">`
    )
  }

  if (proficiencies && proficiencies.length > 0) {
    const profIcons = proficiencies
      .filter((p) => GAME_PROFICIENCY_NAMES[p as number])
      .map(
        (p) =>
          `<img class="stat-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[p as number]}.png`)}" alt="${GAME_PROFICIENCY_NAMES[p as number]}">`
      )
      .join('')
    if (profIcons) html += statRow(m.stat_proficiency(), profIcons)
  }

  if (level) html += statRow(m.stat_uncap(), renderStars(Number(level), type))
  if (minHp) html += statRow(m.stat_min_hp(), Number(minHp).toLocaleString())
  if (maxHp) html += statRow(m.stat_max_hp(), Number(maxHp).toLocaleString())
  if (minAtk) html += statRow(m.stat_min_atk(), Number(minAtk).toLocaleString())
  if (maxAtk) html += statRow(m.stat_max_atk(), Number(maxAtk).toLocaleString())
  if (level) html += statRow(m.stat_max_level(), String(level))

  return { html, master, param }
}

function closeStats(
  html: string,
  data: RawGameItem,
  master: RawMaster | RawGameItem
): string {
  const comment = data.comment || master.comment
  if (comment) {
    html += `<div class="stat-row stat-comment"><span class="stat-value">${comment}</span></div>`
  }
  return html + '</div>'
}

export function renderCharacterStats(
  data: RawGameItem,
  name: string,
  id: string,
  element: string | number | undefined,
  proficiencies: Array<string | number> = []
): string {
  const {
    html: base,
    param,
    master
  } = renderBaseStats({
    data,
    name,
    id,
    element,
    proficiencies,
    seriesMap: GAME_CHARACTER_SERIES_NAMES,
    type: 'character'
  })
  let html = base

  if (param.has_npcaugment_constant) {
    html += statRow(m.stat_perpetuity_ring(), '\u2713')
  }

  return closeStats(html, data, master)
}

export function renderWeaponStats(
  data: RawGameItem,
  name: string,
  id: string,
  element: string | number | undefined,
  proficiency?: string | number
): string {
  const {
    html: base,
    param,
    master
  } = renderBaseStats({
    data,
    name,
    id,
    element,
    proficiencies: proficiency ? [proficiency] : [],
    seriesMap: GAME_WEAPON_SERIES_NAMES,
    type: 'weapon'
  })
  let html = base

  const arousal = param.arousal
  if (arousal?.is_arousal_weapon) {
    html += statRow(
      m.stat_awakening(),
      `${arousal.form_name || 'Attack'} Lv.${arousal.level || 1}`
    )
  }

  const odiant = param.odiant
  if (odiant?.is_odiant_weapon) {
    const befoulSkillMap = param.augment_skill_info?.[0]
    const befoulSkill = befoulSkillMap
      ? Object.values(befoulSkillMap)[0]
      : undefined
    html += statRow(m.stat_befoulment(), befoulSkill?.show_value || 'Active')
    html += statRow(
      m.stat_exorcism(),
      `${odiant.exorcision_level || 0}/${odiant.max_exorcision_level || 5}`
    )
  } else {
    const axSkills = param.augment_skill_info?.[0]
    if (axSkills && Object.keys(axSkills).length > 0) {
      const axCount = Object.keys(axSkills).length
      html += statRow(
        m.stat_ax_skills(),
        `${axCount} skill${axCount > 1 ? 's' : ''}`
      )
    }
  }

  return closeStats(html, data, master)
}

export function renderSummonStats(
  data: RawGameItem,
  name: string,
  id: string,
  element: string | number | undefined
): string {
  const { html: base, master } = renderBaseStats({
    data,
    name,
    id,
    element,
    seriesMap: GAME_SUMMON_SERIES_NAMES,
    type: 'summon'
  })
  let html = base

  const subAura = data.sub_skill?.name
  if (subAura) {
    html += statRow(m.stat_sub_aura(), subAura)
  }

  return closeStats(html, data, master)
}
