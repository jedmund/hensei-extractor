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
