/**
 * @fileoverview Mastery name mappings and formatting functions.
 * Shared between background.js (parsing game data) and popup.js (display).
 */

// ==========================================
// CANONICAL ID → NAME MAPPINGS
// ==========================================

/** Over Mastery (ring) modifier ID to display name */
export const OVER_MASTERY_NAMES = {
  1: 'ATK', 2: 'HP', 3: 'Debuff Success', 4: 'Skill DMG Cap',
  5: 'C.A. DMG', 6: 'C.A. DMG Cap', 7: 'Stamina', 8: 'Enmity',
  9: 'Critical Hit', 10: 'Double Attack', 11: 'Triple Attack', 12: 'DEF',
  13: 'Healing', 14: 'Debuff Resistance', 15: 'Dodge'
}

/** Aetherial Mastery (earring) modifier ID to display name */
export const AETHERIAL_NAMES = {
  1: 'Double Attack', 2: 'Triple Attack', 3: 'Element ATK', 4: 'Element Resistance',
  5: 'Stamina', 6: 'Enmity', 7: 'Supplemental DMG', 8: 'Critical Hit',
  9: 'Counters on Dodge', 10: 'Counters on DMG'
}

/** Perpetuity Ring bonus ID to display name */
export const PERPETUITY_NAMES = {
  1: 'EM Star Cap', 2: 'ATK', 3: 'HP', 4: 'DMG Cap'
}

// ==========================================
// INVERSE NAME → ID MAPPINGS (for parsing game data)
// ==========================================

function invertMap(map) {
  const result = {}
  for (const [k, v] of Object.entries(map)) result[v] = Number(k)
  return result
}

export const OVER_MASTERY_NAME_TO_ID = {
  ...invertMap(OVER_MASTERY_NAMES),
  'Double Attack Rate': 10,
  'Triple Attack Rate': 11
}

export const PERPETUITY_BONUS_NAME_TO_ID = invertMap(PERPETUITY_NAMES)

export const AETHERIAL_MASTERY_NAME_TO_ID = {
  ...invertMap(AETHERIAL_NAMES),
  // Aliases for game data variations
  'Double Attack Rate': 1,
  'Triple Attack Rate': 2,
  'Fire ATK Up': 3, 'Water ATK Up': 3, 'Earth ATK Up': 3,
  'Wind ATK Up': 3, 'Light ATK Up': 3, 'Dark ATK Up': 3,
  'Fire Resistance': 4, 'Water Resistance': 4, 'Earth Resistance': 4,
  'Wind Resistance': 4, 'Light Resistance': 4, 'Dark Resistance': 4,
  'Critical Hit Rate': 8
}

// ==========================================
// DISPLAY FORMATTING
// ==========================================

/** Stats that use flat values (not percentages) */
const FLAT_VALUE_STATS = new Set(['ATK', 'HP', 'Stamina', 'Enmity', 'Supplemental DMG'])

/**
 * Format a ring/earring modifier for display
 * @param {Object} mod - Modifier object with { modifier, strength, typeName }
 * @param {Object} nameMap - ID-to-name mapping (OVER_MASTERY_NAMES or AETHERIAL_NAMES)
 * @returns {string|null} Formatted string like "ATK +500" or "Critical Hit +5%"
 */
export function formatModifier(mod, nameMap) {
  if (!mod || !mod.modifier) return null

  // For element-based stats, prefer the actual typeName (e.g., "Fire ATK Up" instead of "Element ATK")
  let name = nameMap[mod.modifier] || mod.typeName || `Mod ${mod.modifier}`
  if ((name === 'Element ATK' || name === 'Element Resistance') && mod.typeName) {
    name = mod.typeName
  }

  const value = mod.strength

  // ATK and HP get formatted with commas (for Over Mastery rings)
  if (name === 'ATK' || name === 'HP') {
    return `${name} +${Number(value).toLocaleString()}`
  }

  // Flat value stats (no percentage sign)
  if (FLAT_VALUE_STATS.has(name)) {
    return `${name} +${value}`
  }

  // All other stats are percentages
  return `${name} +${value}%`
}

/**
 * Format a perpetuity ring bonus for display
 * @param {Object} bonus - Bonus object with { modifier, strength, typeName }
 * @returns {string|null} Formatted string
 */
export function formatPerpetuityBonus(bonus) {
  if (!bonus || !bonus.modifier) return null
  const name = PERPETUITY_NAMES[bonus.modifier] || bonus.typeName || `Bonus ${bonus.modifier}`
  const value = bonus.strength

  if (bonus.modifier === 1) {
    // EM Star Cap is a flat value
    return `${name} +${value}`
  }
  // ATK, HP, DMG Cap are percentages for perpetuity
  if (bonus.modifier >= 2 && bonus.modifier <= 4) {
    return `${name} +${value}%`
  }
  return `${name} +${value}`
}

// ==========================================
// PARSING HELPERS (used by background.js)
// ==========================================

/**
 * Parse a display parameter string (e.g., "+500") into a number
 */
export function parseDisplayValue(dispParam) {
  if (!dispParam) return 0
  const str = String(dispParam).replace(/^\+/, '')
  return parseInt(str, 10) || 0
}
