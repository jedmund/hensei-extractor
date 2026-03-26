/**
 * @fileoverview Game data constants for Granblue Fantasy.
 * Maps game IDs to human-readable names for elements, proficiencies, series, etc.
 */

// ==========================================
// RARITY
// ==========================================

export const RARITY_LABELS = { '4': 'SSR', '3': 'SR', '2': 'R' }

// ==========================================
// ELEMENTS & PROFICIENCIES
// ==========================================

export const GAME_ELEMENT_NAMES = {
  1: 'Fire',
  2: 'Water',
  3: 'Earth',
  4: 'Wind',
  5: 'Light',
  6: 'Dark'
}

export const GAME_PROFICIENCY_NAMES = {
  1: 'Sabre',
  2: 'Dagger',
  3: 'Axe',
  4: 'Spear',
  5: 'Bow',
  6: 'Staff',
  7: 'Melee',
  8: 'Harp',
  9: 'Gun',
  10: 'Katana'
}

// ==========================================
// WEAPON AWAKENING ICONS
// ==========================================

export const WEAPON_AWAKENING_ICONS = {
  'Attack': 'weapon-atk',
  'Defense': 'weapon-def',
  'Multiattack': 'weapon-multi',
  'Charge Attack': 'weapon-ca',
  'Skill': 'weapon-skill',
  'Healing': 'weapon-heal',
  'Special': 'weapon-special'
}

// ==========================================
// AUGMENT ICON MAPPING (game API slug → S3 filename without extension)
// ==========================================

export const AUGMENT_ICON_MAP = {
  // AX skills
  ex_skill_atk: 'ax_atk',
  ex_skill_hp: 'ax_hp',
  ex_skill_def: 'ax_def',
  ex_skill_da: 'ax_da',
  ex_skill_ta: 'ax_ta',
  ex_skill_exp: 'ax_exp',
  ex_skill_attribute: 'ax_ele_atk',
  ex_skill_sp_atk: 'ax_ca_dmg',
  ex_skill_sp_add: 'ax_ca_supp',
  ex_skill_normal_limit: 'ax_na_cap',
  ex_skill_ab_add: 'ax_healing',
  ex_skill_ab_limit: 'ax_skill_cap',
  ex_skill_backwater: 'ax_enmity',
  ex_skill_whole: 'ax_stamina',
  ex_skill_guard_ailment: 'ax_debuff_res',
  // Befoulment
  ex_skill_atk_down: 'befoul_atk_down',
  ex_skill_def_down: 'befoul_def_down',
  ex_skill_hp_down: 'befoul_hp_down',
  ex_skill_ta_down: 'befoul_da_ta_down',
  ex_skill_sp_atk_down: 'befoul_ca_dmg_down',
  ex_skill_ab_atk_down: 'befoul_ability_dmg_down',
  ex_skill_ailment_enhance_down: 'befoul_debuff_down',
}

// ==========================================
// SPECIAL WEAPON SERIES (series with weapon keys)
// ==========================================

export const WEAPON_KEY_SERIES = new Set([3, 13, 17, 19, 27, 40, 44])

// ==========================================
// CHARACTER AWAKENING ICONS
// ==========================================

export const CHARACTER_AWAKENING_MAPPING = {
  1: 'character-balanced',
  2: 'character-atk',
  3: 'character-def',
  4: 'character-multi'
}

// ==========================================
// SERIES NAMES
// ==========================================

export const GAME_CHARACTER_SERIES_NAMES = {
  1: 'Summer',
  2: 'Yukata',
  3: 'Valentine',
  4: 'Halloween',
  5: 'Holiday',
  6: 'Zodiac',
  7: 'Grand',
  8: 'Fantasy',
  9: 'Collab',
  10: 'Eternal',
  11: 'Evoker',
  12: 'Saint',
  13: 'Formal'
}

export const GAME_WEAPON_SERIES_NAMES = {
  1: 'Seraphic',
  2: 'Grand',
  3: 'Dark Opus',
  4: 'Revenant',
  5: 'Primal',
  6: 'Beast',
  7: 'Regalia',
  8: 'Omega',
  9: 'Olden Primal',
  10: 'Hollowsky',
  11: 'Xeno',
  12: 'Rose',
  13: 'Ultima',
  14: 'Bahamut',
  15: 'Epic',
  16: 'Cosmos',
  17: 'Superlative',
  18: 'Vintage',
  19: 'Class Champion',
  20: 'Replica',
  21: 'Relic',
  22: 'Rusted',
  23: 'Sephira',
  24: 'Vyrmament',
  25: 'Upgrader',
  26: 'Astral',
  27: 'Draconic',
  28: 'Eternal Splendor',
  29: 'Ancestral',
  30: 'New World Foundation',
  31: 'Ennead',
  32: 'Militis',
  33: 'Malice',
  34: 'Menace',
  35: 'Illustrious',
  36: 'Proven',
  37: 'Revans',
  38: 'World',
  39: 'Exo',
  40: 'Draconic Providence',
  41: 'Celestial',
  42: 'Omega Rebirth',
  43: 'Collab',
  44: 'Destroyer'
}

// ==========================================
// FORGED ARCARUM SUMMON ID MAPPING
// Forged Arcarum summons use different master IDs in-game.
// Maps forged (evolved) IDs → base SSR IDs stored in the database.
// ==========================================

export const FORGED_ARCARUM_SUMMON_IDS = {
  '2040313000': '2040236000', // Justice
  '2040314000': '2040237000', // The Hanged Man
  '2040315000': '2040238000', // Death
  '2040316000': '2040239000', // Temperance
  '2040317000': '2040240000', // The Devil
  '2040318000': '2040241000', // The Tower
  '2040319000': '2040242000', // The Star
  '2040320000': '2040243000', // The Moon
  '2040321000': '2040244000', // The Sun
  '2040322000': '2040245000', // Judgement
}

export function resolveForgedSummonId(id) {
  return FORGED_ARCARUM_SUMMON_IDS[String(id)] || id
}

export const GAME_SUMMON_SERIES_NAMES = {
  1: 'Providence',
  2: 'Genesis',
  3: 'Magna',
  4: 'Optimus',
  5: 'Demi Optimus',
  6: 'Archangel',
  7: 'Arcarum',
  8: 'Epic',
  9: 'Carbuncle',
  10: 'Dynamis',
  12: 'Cryptid',
  13: 'Six Dragons',
  14: 'Summer',
  15: 'Yukata',
  16: 'Holiday',
  17: 'Collab',
  18: 'Bellum',
  19: 'Crest',
  20: 'Robur'
}
