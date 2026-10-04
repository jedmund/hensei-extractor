/**
 * Stat data for the database detail view and item lists, as plain data for
 * Svelte components to render. Nothing here builds HTML: game-supplied text
 * (series names, awakening forms, sub auras, comments) is rendered as text
 * by the components, so it's escaped.
 */

import { getImageUrl } from './constants.js'
import {
  GAME_ELEMENT_NAMES,
  GAME_PROFICIENCY_NAMES,
  GAME_CHARACTER_SERIES_NAMES,
  GAME_WEAPON_SERIES_NAMES,
  GAME_SUMMON_SERIES_NAMES
} from './game-data.js'
import { firstAugmentShowValue, type RawGameItem } from './detail-helpers.js'
import { decodeHtmlEntities } from './html-entities.js'
import { translateSeries } from './i18n.js'
import * as m from '../paraglide/messages.js'

export type StatItemType = 'character' | 'weapon' | 'summon'

export interface StatIcon {
  src: string
  alt: string
}

export type StatValue =
  | { kind: 'text'; text: string }
  | { kind: 'icons'; icons: StatIcon[] }
  | { kind: 'stars'; stars: string[] | null }

export interface StatRowData {
  label: string
  value: StatValue
}

type ElementKey = keyof typeof GAME_ELEMENT_NAMES

function textRow(label: string, text: string): StatRowData {
  return { label, value: { kind: 'text', text } }
}

function elementName(element: string | number | undefined) {
  return element ? GAME_ELEMENT_NAMES[element as ElementKey] : undefined
}

function elementIconUrl(name: string): string {
  return getImageUrl(`labels/element/Label_Element_${name}.png`)
}

function proficiencyIconUrl(name: string): string {
  return getImageUrl(`labels/proficiency/Label_Weapon_${name}.png`)
}

// ==========================================
// STARS
// ==========================================

const STAR_CONFIGS: Record<
  StatItemType,
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

/**
 * The class of each uncap star for an item with this max level: the base
 * stars are 'filled', then 'flb'/'ulb' for each tier the level reaches.
 * Null for an unknown item type.
 */
export function starClasses(maxLevel: number, type: string): string[] | null {
  const config = STAR_CONFIGS[type as StatItemType]
  if (!config) return null
  const stars: string[] = Array(config.base).fill('filled')
  for (const tier of config.tiers) {
    if (maxLevel >= tier.level) stars.push(tier.cls)
  }
  return stars
}

// ==========================================
// ARTIFACT LABELS
// ==========================================

/** Element and proficiency label icons for an artifact list row */
export function artifactLabelIcons(item: RawGameItem): string[] {
  const icons: string[] = []
  const element = elementName(item.attribute || item.element)
  if (element) icons.push(elementIconUrl(element))
  const proficiency = item.kind || item.weapon_kind
  const proficiencyName = proficiency
    ? GAME_PROFICIENCY_NAMES[Number(proficiency)]
    : undefined
  if (proficiencyName) icons.push(proficiencyIconUrl(proficiencyName))
  return icons
}

// ==========================================
// COMMENT TEXT
// ==========================================

const LINE_BREAK = /<br\s*\/?>/i
// The game wraps notes in <span class="text-blue"> (sometimes with the
// attribute unquoted); the extension doesn't style that class, so it's dropped.
const FORMATTING_TAG = /<\/?span\b[^>]*>/gi

/**
 * Splits the game's flavour text into lines for display as text. <br> becomes
 * a line break and <span> wrappers are dropped; any other markup stays as
 * literal text, which the component escapes. Entities are decoded so text
 * reads as it did when this was rendered as HTML.
 */
export function commentLines(comment: string | undefined | null): string[] {
  if (!comment) return []
  return comment
    .split(LINE_BREAK)
    .map((line) => decodeHtmlEntities(line.replace(FORMATTING_TAG, '')))
}

/** The item's flavour text as lines; empty when it has none */
export function itemCommentLines(data: RawGameItem): string[] {
  return commentLines(data.comment || data.master?.comment)
}

// ==========================================
// STAT ROWS
// ==========================================

type RawParam = NonNullable<RawGameItem['param']>

function baseStatRows({
  data,
  id,
  seriesMap,
  element,
  proficiencies,
  type
}: {
  data: RawGameItem
  id: string
  seriesMap: Record<number, string>
  element?: string | number
  proficiencies?: Array<string | number>
  type: StatItemType
}): StatRowData[] {
  const master = data.master ?? data
  const param = data.param ?? ({} as RawParam)

  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  const rows: StatRowData[] = []
  if (id) rows.push(textRow(m.stat_id(), id))

  const seriesId = Number(data.series_id || master.series_id)
  const series = seriesId ? seriesMap[seriesId] : undefined
  if (series) rows.push(textRow(m.stat_series(), translateSeries(series, type)))

  const elementLabel = elementName(element)
  if (elementLabel) {
    rows.push({
      label: m.stat_element(),
      value: {
        kind: 'icons',
        icons: [{ src: elementIconUrl(elementLabel), alt: elementLabel }]
      }
    })
  }

  const proficiencyIcons = (proficiencies ?? [])
    .map((p) => GAME_PROFICIENCY_NAMES[p as number])
    .filter((name): name is string => !!name)
    .map((name) => ({ src: proficiencyIconUrl(name), alt: name }))
  if (proficiencyIcons.length > 0) {
    rows.push({
      label: m.stat_proficiency(),
      value: { kind: 'icons', icons: proficiencyIcons }
    })
  }

  if (level) {
    rows.push({
      label: m.stat_uncap(),
      value: { kind: 'stars', stars: starClasses(Number(level), type) }
    })
  }
  if (minHp) rows.push(textRow(m.stat_min_hp(), Number(minHp).toLocaleString()))
  if (maxHp) rows.push(textRow(m.stat_max_hp(), Number(maxHp).toLocaleString()))
  if (minAtk) {
    rows.push(textRow(m.stat_min_atk(), Number(minAtk).toLocaleString()))
  }
  if (maxAtk) {
    rows.push(textRow(m.stat_max_atk(), Number(maxAtk).toLocaleString()))
  }
  if (level) rows.push(textRow(m.stat_max_level(), String(level)))

  return rows
}

export function characterStatRows(
  data: RawGameItem,
  id: string,
  element: string | number | undefined,
  proficiencies: Array<string | number> = []
): StatRowData[] {
  const rows = baseStatRows({
    data,
    id,
    element,
    proficiencies,
    seriesMap: GAME_CHARACTER_SERIES_NAMES,
    type: 'character'
  })
  if (data.param?.has_npcaugment_constant) {
    rows.push(textRow(m.stat_perpetuity_ring(), '✓'))
  }
  return rows
}

export function weaponStatRows(
  data: RawGameItem,
  id: string,
  element: string | number | undefined,
  proficiency?: string | number
): StatRowData[] {
  const rows = baseStatRows({
    data,
    id,
    element,
    proficiencies: proficiency ? [proficiency] : [],
    seriesMap: GAME_WEAPON_SERIES_NAMES,
    type: 'weapon'
  })
  const param = data.param ?? ({} as RawParam)

  const arousal = param.arousal
  if (arousal?.is_arousal_weapon) {
    rows.push(
      textRow(
        m.stat_awakening(),
        `${arousal.form_name || m.awakening_attack()} Lv.${arousal.level || 1}`
      )
    )
  }

  const odiant = param.odiant
  if (odiant?.is_odiant_weapon) {
    rows.push(
      textRow(
        m.stat_befoulment(),
        firstAugmentShowValue(param.augment_skill_info?.[0]) ||
          m.stat_befoulment_active()
      )
    )
    rows.push(
      textRow(
        m.stat_exorcism(),
        `${odiant.exorcision_level || 0}/${odiant.max_exorcision_level || 5}`
      )
    )
  } else {
    const axSkills = param.augment_skill_info?.[0]
    const axCount = axSkills ? Object.keys(axSkills).length : 0
    if (axCount > 0) {
      rows.push(
        textRow(
          m.stat_ax_skills(),
          axCount > 1
            ? m.stat_ax_skill_count_plural({ count: axCount })
            : m.stat_ax_skill_count({ count: axCount })
        )
      )
    }
  }

  return rows
}

export function summonStatRows(
  data: RawGameItem,
  id: string,
  element: string | number | undefined
): StatRowData[] {
  const rows = baseStatRows({
    data,
    id,
    element,
    seriesMap: GAME_SUMMON_SERIES_NAMES,
    type: 'summon'
  })
  const subAura = data.sub_skill?.name
  if (subAura) rows.push(textRow(m.stat_sub_aura(), subAura))
  return rows
}
