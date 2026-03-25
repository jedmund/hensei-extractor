/**
 * @fileoverview Mastery name mappings and formatting functions.
 * Shared between background.js (parsing game data) and popup.js (display).
 */

import { t, getLocale } from "./i18n.js";

// ==========================================
// CANONICAL ID → NAME MAPPINGS
// (English names used for parsing; display uses i18n)
// ==========================================

/** Over Mastery (ring) modifier ID to English name (for parsing) */
export const OVER_MASTERY_NAMES = {
  1: "ATK",
  2: "HP",
  3: "Debuff Success",
  4: "Skill DMG Cap",
  5: "C.A. DMG",
  6: "C.A. DMG Cap",
  7: "Stamina",
  8: "Enmity",
  9: "Critical Hit",
  10: "Double Attack",
  11: "Triple Attack",
  12: "DEF",
  13: "Healing",
  14: "Debuff Resistance",
  15: "Dodge",
};

/** Aetherial Mastery (earring) modifier ID to English name (for parsing) */
export const AETHERIAL_NAMES = {
  1: "Double Attack",
  2: "Triple Attack",
  3: "Element ATK",
  4: "Element Resistance",
  5: "Stamina",
  6: "Enmity",
  7: "Supplemental DMG",
  8: "Critical Hit",
  9: "Counters on Dodge",
  10: "Counters on DMG",
};

/** Perpetuity Ring bonus ID to English name (for parsing) */
export const PERPETUITY_NAMES = {
  1: "EM Star Cap",
  2: "ATK",
  3: "HP",
  4: "DMG Cap",
};

// ==========================================
// DISPLAY NAME MAPPING (English → i18n key)
// ==========================================

const MASTERY_I18N_KEYS = {
  ATK: "mastery_atk",
  HP: "mastery_hp",
  "Debuff Success": "mastery_debuff_success",
  "Skill DMG Cap": "mastery_skill_dmg_cap",
  "C.A. DMG": "mastery_ca_dmg",
  "C.A. DMG Cap": "mastery_ca_dmg_cap",
  Stamina: "mastery_stamina",
  Enmity: "mastery_enmity",
  "Critical Hit": "mastery_critical_hit",
  "Double Attack": "mastery_double_attack",
  "Triple Attack": "mastery_triple_attack",
  DEF: "mastery_def",
  Healing: "mastery_healing",
  "Debuff Resistance": "mastery_debuff_resistance",
  Dodge: "mastery_dodge",
  "Element ATK": "mastery_element_atk",
  "Element Resistance": "mastery_element_resistance",
  "Supplemental DMG": "mastery_supplemental_dmg",
  "Counters on Dodge": "mastery_counters_dodge",
  "Counters on DMG": "mastery_counters_dmg",
  "EM Star Cap": "mastery_em_star_cap",
  "DMG Cap": "mastery_dmg_cap",
};

/**
 * Get the display name for a mastery stat, translated if applicable
 */
function getDisplayName(englishName) {
  if (getLocale() === "en") return englishName;
  const key = MASTERY_I18N_KEYS[englishName];
  if (key) return t(key);
  return englishName;
}

// ==========================================
// GAME TYPE ID → INTERNAL MODIFIER ID MAPPINGS
// These use the game's type.id field, which is language-independent.
// ==========================================

/** Over Mastery (ring) game type.id → internal modifier ID */
export const OVER_MASTERY_TYPE_ID = {
  // Primary (slot 1) — ATK/HP share id 10001, distinguished by split_key
  // Secondary (slot 2)
  20001: 9, // Critical Hit Rate
  20002: 8, // Enmity
  20003: 7, // Stamina
  20004: 5, // C.A. DMG
  20005: 4, // Skill DMG Cap
  20006: 6, // C.A. DMG Cap
  20008: 3, // Debuff Success Rate
  // Tertiary (slot 3)
  30001: 10, // Double Attack Rate
  30002: 11, // Triple Attack Rate
  30003: 12, // DEF
  30004: 14, // Debuff Resistance
  30005: 15, // Dodge Rate
  30006: 13, // Healing
};

/**
 * Aetherial Mastery (earring) game type.id → internal modifier ID.
 * The game uses varying prefixes (11, 12, 13, 14) by character rarity,
 * but the last 4 digits (suffix) are the modifier key.
 */
const AETHERIAL_SUFFIX_TO_ID = {
  "0001": 6, // Enmity
  "0002": 5, // Stamina
  "0003": 8, // Critical Hit Rate
  "0004": 1, // Double Attack Rate
  "0005": 2, // Triple Attack Rate
  "0006": 3, // Element ATK
  "0007": 4, // Element Resistance
  "0008": 7, // Supplemental DMG
  "0009": 10, // Counters on DMG
  "0010": 9, // Counters on Dodge
};

/** Look up earring modifier by suffix of game type.id */
export function lookupAetherialTypeId(typeId) {
  const suffix = String(typeId).slice(-4);
  return AETHERIAL_SUFFIX_TO_ID[suffix] || null;
}

/** Perpetuity game type.id → internal modifier ID */
export const PERPETUITY_TYPE_ID = {
  100001: 1, // EM Star Cap
  100002: 2, // ATK
  100003: 3, // HP
  100004: 4, // DMG Cap
};

// ==========================================
// DISPLAY FORMATTING
// ==========================================

/** Stats that use flat values (not percentages) */
const FLAT_VALUE_STATS = new Set([
  "ATK",
  "HP",
  "Stamina",
  "Enmity",
  "Supplemental DMG",
]);

/**
 * Format a ring/earring modifier for display
 * @param {Object} mod - Modifier object with { modifier, strength, typeName }
 * @param {Object} nameMap - ID-to-name mapping (OVER_MASTERY_NAMES or AETHERIAL_NAMES)
 * @returns {string|null} Formatted string like "ATK +500" or "Critical Hit +5%"
 */
export function formatModifier(mod, nameMap) {
  if (!mod || !mod.modifier) return null;

  // For element-based stats, prefer the actual typeName (e.g., "Fire ATK Up" instead of "Element ATK")
  let englishName =
    nameMap[mod.modifier] || mod.typeName || `Mod ${mod.modifier}`;
  if (
    (englishName === "Element ATK" || englishName === "Element Resistance") &&
    mod.typeName
  ) {
    englishName = mod.typeName;
  }

  const displayName = getDisplayName(englishName);
  const value = mod.strength;

  // ATK and HP get formatted with commas (for Over Mastery rings)
  if (englishName === "ATK" || englishName === "HP") {
    return `${displayName} +${Number(value).toLocaleString()}`;
  }

  // Flat value stats (no percentage sign)
  if (FLAT_VALUE_STATS.has(englishName)) {
    return `${displayName} +${value}`;
  }

  // All other stats are percentages
  return `${displayName} +${value}%`;
}

/**
 * Format a perpetuity ring bonus for display
 * @param {Object} bonus - Bonus object with { modifier, strength, typeName }
 * @returns {string|null} Formatted string
 */
export function formatPerpetuityBonus(bonus) {
  if (!bonus || !bonus.modifier) return null;
  const englishName =
    PERPETUITY_NAMES[bonus.modifier] ||
    bonus.typeName ||
    `Bonus ${bonus.modifier}`;
  const displayName = getDisplayName(englishName);
  const value = bonus.strength;

  if (bonus.modifier === 1) {
    // EM Star Cap is a flat value
    return `${displayName} +${value}`;
  }
  // ATK, HP, DMG Cap are percentages for perpetuity
  if (bonus.modifier >= 2 && bonus.modifier <= 4) {
    return `${displayName} +${value}%`;
  }
  return `${displayName} +${value}`;
}

// ==========================================
// PARSING HELPERS (used by background.js)
// ==========================================

/**
 * Parse a display parameter string (e.g., "+500") into a number
 */
export function parseDisplayValue(dispParam) {
  if (!dispParam) return 0;
  const str = String(dispParam).replace(/^\+/, "");
  return parseInt(str, 10) || 0;
}
