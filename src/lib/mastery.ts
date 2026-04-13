/**
 * Mastery name mappings and formatting functions.
 * Shared between background.ts (parsing game data) and popup.js (display).
 */

import * as m from '../paraglide/messages.js'
import { getLocale } from './i18n.js'

// ==========================================
// CANONICAL ID → NAME MAPPINGS
// ==========================================

export const OVER_MASTERY_NAMES: Record<number, string> = {
  1: 'ATK',
  2: 'HP',
  3: 'Debuff Success',
  4: 'Skill DMG Cap',
  5: 'C.A. DMG',
  6: 'C.A. DMG Cap',
  7: 'Stamina',
  8: 'Enmity',
  9: 'Critical Hit',
  10: 'Double Attack',
  11: 'Triple Attack',
  12: 'DEF',
  13: 'Healing',
  14: 'Debuff Resistance',
  15: 'Dodge'
}

export const AETHERIAL_NAMES: Record<number, string> = {
  1: 'Double Attack',
  2: 'Triple Attack',
  3: 'Element ATK',
  4: 'Element Resistance',
  5: 'Stamina',
  6: 'Enmity',
  7: 'Supplemental DMG',
  8: 'Critical Hit',
  9: 'Counters on Dodge',
  10: 'Counters on DMG'
}

export const PERPETUITY_NAMES: Record<number, string> = {
  1: 'EM Star Cap',
  2: 'ATK',
  3: 'HP',
  4: 'DMG Cap'
}

// ==========================================
// DISPLAY NAME MAPPING (English → i18n key)
// ==========================================

const MASTERY_NAMES: Record<string, () => string> = {
  ATK: m.mastery_atk,
  HP: m.mastery_hp,
  'Debuff Success': m.mastery_debuff_success,
  'Skill DMG Cap': m.mastery_skill_dmg_cap,
  'C.A. DMG': m.mastery_ca_dmg,
  'C.A. DMG Cap': m.mastery_ca_dmg_cap,
  Stamina: m.mastery_stamina,
  Enmity: m.mastery_enmity,
  'Critical Hit': m.mastery_critical_hit,
  'Double Attack': m.mastery_double_attack,
  'Triple Attack': m.mastery_triple_attack,
  DEF: m.mastery_def,
  Healing: m.mastery_healing,
  'Debuff Resistance': m.mastery_debuff_resistance,
  Dodge: m.mastery_dodge,
  'Element ATK': m.mastery_element_atk,
  'Element Resistance': m.mastery_element_resistance,
  'Supplemental DMG': m.mastery_supplemental_dmg,
  'Counters on Dodge': m.mastery_counters_dodge,
  'Counters on DMG': m.mastery_counters_dmg,
  'EM Star Cap': m.mastery_em_star_cap,
  'DMG Cap': m.mastery_dmg_cap
}

function getDisplayName(englishName: string): string {
  if (getLocale() === 'en') return englishName
  const fn = MASTERY_NAMES[englishName]
  if (fn) return fn()
  return englishName
}

// ==========================================
// GAME TYPE ID → INTERNAL MODIFIER ID MAPPINGS
// ==========================================

export const OVER_MASTERY_TYPE_ID: Record<number, number> = {
  20001: 9, // Critical Hit Rate
  20002: 8, // Enmity
  20003: 7, // Stamina
  20004: 5, // C.A. DMG
  20005: 4, // Skill DMG Cap
  20006: 6, // C.A. DMG Cap
  20008: 3, // Debuff Success Rate
  30001: 10, // Double Attack Rate
  30002: 11, // Triple Attack Rate
  30003: 12, // DEF
  30004: 14, // Debuff Resistance
  30005: 15, // Dodge Rate
  30006: 13 // Healing
}

const AETHERIAL_SUFFIX_TO_ID: Record<string, number> = {
  '0001': 6, // Enmity
  '0002': 5, // Stamina
  '0003': 8, // Critical Hit Rate
  '0004': 1, // Double Attack Rate
  '0005': 2, // Triple Attack Rate
  '0006': 3, // Element ATK
  '0007': 4, // Element Resistance
  '0008': 7, // Supplemental DMG
  '0009': 10, // Counters on DMG
  '0010': 9 // Counters on Dodge
}

export function lookupAetherialTypeId(typeId: number): number | null {
  const suffix = String(typeId).slice(-4)
  return AETHERIAL_SUFFIX_TO_ID[suffix] ?? null
}

export const PERPETUITY_TYPE_ID: Record<number, number> = {
  100001: 1, // EM Star Cap
  100002: 2, // ATK
  100003: 3, // HP
  100004: 4 // DMG Cap
}

// ==========================================
// DISPLAY FORMATTING
// ==========================================

interface MasteryModifier {
  modifier: number
  strength: number | string
  typeName?: string
}

const FLAT_VALUE_STATS = new Set([
  'ATK',
  'HP',
  'Stamina',
  'Enmity',
  'Supplemental DMG'
])

export function formatModifier(
  mod: MasteryModifier | null | undefined,
  nameMap: Record<number, string>
): string | null {
  if (!mod?.modifier) return null

  let englishName =
    nameMap[mod.modifier] ?? mod.typeName ?? `Mod ${mod.modifier}`
  if (
    (englishName === 'Element ATK' || englishName === 'Element Resistance') &&
    mod.typeName
  ) {
    englishName = mod.typeName
  }

  const displayName = getDisplayName(englishName)
  const value = mod.strength

  if (englishName === 'ATK' || englishName === 'HP') {
    return `${displayName} +${Number(value).toLocaleString()}`
  }

  if (FLAT_VALUE_STATS.has(englishName)) {
    return `${displayName} +${value}`
  }

  return `${displayName} +${value}%`
}

export function formatPerpetuityBonus(
  bonus: MasteryModifier | null | undefined
): string | null {
  if (!bonus?.modifier) return null
  const englishName =
    PERPETUITY_NAMES[bonus.modifier] ??
    bonus.typeName ??
    `Bonus ${bonus.modifier}`
  const displayName = getDisplayName(englishName)
  const value = bonus.strength

  if (bonus.modifier === 1) {
    return `${displayName} +${value}`
  }
  if (bonus.modifier >= 2 && bonus.modifier <= 4) {
    return `${displayName} +${value}%`
  }
  return `${displayName} +${value}`
}

export function parseDisplayValue(
  dispParam: string | null | undefined
): number {
  if (!dispParam) return 0
  const str = String(dispParam).replace(/^\+/, '')
  return parseInt(str, 10) || 0
}
