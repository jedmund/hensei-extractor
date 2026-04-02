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
import { t, tPlural, translateSeries, getLocale } from './i18n.js'

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

export function toArray(data: any): any[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return Object.values(data)
}

export function extractItems(dataType: string, data: any): any[] {
  if (
    dataType.startsWith('collection_') ||
    dataType.startsWith('list_') ||
    dataType.startsWith('stash_')
  ) {
    const pages = Object.values(data) as any[]
    return pages.flatMap((page) => page.list || [])
  }
  if (dataType.startsWith('party_')) {
    const deck = data.deck || {}
    const pc = deck.pc || {}
    return [
      ...toArray(deck.npc),
      ...toArray(pc.weapons),
      ...toArray(pc.summons),
      ...toArray(pc.sub_summons)
    ].filter(Boolean)
  }
  return [data]
}

export function countItems(dataType: string, data: any): number {
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

function getCharacterImageSuffix(item: any, simplePortraits: boolean): string {
  if (item.param?.style === '2') return '_01_style'
  const evolution = item.param?.evolution
  const phase = item.param?.phase
  return getCharacterPose(evolution, phase, simplePortraits)
}

function getImageSuffix(item: any): string {
  const imageId = item.param?.image_id
  if (!imageId) return ''

  const id = item.master?.id || item.param?.id || item.id
  if (!id || !imageId.startsWith(String(id))) return ''

  return imageId.slice(String(id).length)
}

export function getItemImageUrl(
  dataType: string,
  item: any,
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
    const resolvedId = resolveForgedSummonId(granblueId)
    return getImageUrl(`summon-square/${resolvedId}${suffix}.jpg`)
  }
  if (dataType.includes('artifact')) {
    const artifactId = item.artifact_id || granblueId
    return getImageUrl(`artifact-square/${artifactId}.jpg`)
  }
  return ''
}

export function getArtifactLabels(item: any): string {
  const element = item.attribute || item.element
  const proficiency = item.kind || item.weapon_kind

  let html = '<div class="list-item-labels">'

  if (
    element &&
    GAME_ELEMENT_NAMES[element as keyof typeof GAME_ELEMENT_NAMES]
  ) {
    html += `<img class="label-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element as keyof typeof GAME_ELEMENT_NAMES]}.png`)}" alt="">`
  }

  if (proficiency && GAME_PROFICIENCY_NAMES[proficiency]) {
    html += `<img class="label-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[proficiency]}.png`)}" alt="">`
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

export function getCharacterModifiers(item: any): CharacterModifiers {
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
  axSkill: { skill: any; iconImage: string | null } | null
  befoulment: {
    skill: any
    exorcismLevel: number
    maxExorcismLevel: number
    iconImage: string | null
  } | null
  weaponKeys: string[]
}

export function getWeaponModifiers(
  item: any,
  weaponKeyMap: Record<string, string> | null = null
): WeaponModifiers {
  const param = item.param || {}
  const odiant = param.odiant || {}
  const isOdiant = odiant.is_odiant_weapon === true

  const weaponKeys: string[] = []
  if (weaponKeyMap) {
    const seriesId = parseInt(item.master?.series_id)
    if (WEAPON_KEY_SERIES.has(seriesId)) {
      const weaponProficiency = parseInt(item.master?.kind) || null
      for (const skillKey of ['skill1', 'skill2', 'skill3']) {
        const skillId = item[skillKey]?.id
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
        ? param.arousal
        : null,
    axSkill:
      !isOdiant && param.augment_skill_info?.[0]
        ? {
            skill: param.augment_skill_info[0],
            iconImage: param.augment_skill_icon_image?.[0] || null
          }
        : null,
    befoulment: isOdiant
      ? {
          skill: param.augment_skill_info?.[0]?.[0] || null,
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

/** Build an AX skill tooltip from skill entries */
export function buildAxTooltip(
  skill: any,
  iconImage: string | null,
  weaponStatModifiers: Record<string, any> | null,
  locale: string
): string {
  const iconSlug = iconImage || 'ex_skill_atk'
  const axEntries = Object.values(skill || {})
  if (axEntries.length === 0) return t('stat_ax_skills')
  return axEntries
    .map((s: any) => {
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
  data: any
  name: string
  id: string
  seriesMap?: Record<number, string>
  element?: string | number
  proficiencies?: Array<string | number>
  type: 'weapon' | 'summon' | 'character'
}) {
  const master = data.master || data
  const param = data.param || {}

  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'
  html += statRow(t('stat_name'), name)
  if (id) html += statRow(t('stat_id'), id)

  const seriesId = data.series_id || master.series_id
  if (seriesId && seriesMap?.[seriesId]) {
    html += statRow(
      t('stat_series'),
      translateSeries(seriesMap[seriesId], type)
    )
  }

  if (
    element &&
    GAME_ELEMENT_NAMES[element as keyof typeof GAME_ELEMENT_NAMES]
  ) {
    html += statRow(
      t('stat_element'),
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
    if (profIcons) html += statRow(t('stat_proficiency'), profIcons)
  }

  if (level) html += statRow(t('stat_uncap'), renderStars(level, type))
  if (minHp) html += statRow(t('stat_min_hp'), Number(minHp).toLocaleString())
  if (maxHp) html += statRow(t('stat_max_hp'), Number(maxHp).toLocaleString())
  if (minAtk)
    html += statRow(t('stat_min_atk'), Number(minAtk).toLocaleString())
  if (maxAtk)
    html += statRow(t('stat_max_atk'), Number(maxAtk).toLocaleString())
  if (level) html += statRow(t('stat_max_level'), level)

  return { html, master, param }
}

function closeStats(html: string, data: any, master: any): string {
  const comment = data.comment || master.comment
  if (comment) {
    html += `<div class="stat-row stat-comment"><span class="stat-value">${comment}</span></div>`
  }
  return html + '</div>'
}

export function renderCharacterStats(
  data: any,
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
    html += statRow(t('stat_perpetuity_ring'), '\u2713')
  }

  return closeStats(html, data, master)
}

export function renderWeaponStats(
  data: any,
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
      t('stat_awakening'),
      `${arousal.form_name || 'Attack'} Lv.${arousal.level || 1}`
    )
  }

  const odiant = param.odiant
  if (odiant?.is_odiant_weapon) {
    const befoulSkill = param.augment_skill_info?.[0]?.[0]
    html += statRow(t('stat_befoulment'), befoulSkill?.show_value || 'Active')
    html += statRow(
      t('stat_exorcism'),
      `${odiant.exorcision_level || 0}/${odiant.max_exorcision_level || 5}`
    )
  } else {
    const axSkills = param.augment_skill_info?.[0]
    if (axSkills && Object.keys(axSkills).length > 0) {
      const axCount = Object.keys(axSkills).length
      html += statRow(
        t('stat_ax_skills'),
        `${axCount} skill${axCount > 1 ? 's' : ''}`
      )
    }
  }

  return closeStats(html, data, master)
}

export function renderSummonStats(
  data: any,
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
    html += statRow(t('stat_sub_aura'), subAura)
  }

  return closeStats(html, data, master)
}
