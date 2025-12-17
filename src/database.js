/**
 * @fileoverview Database detail rendering for characters, weapons, and summons.
 */

import { getImageUrl } from "../constants.js"

// Granblue Fantasy CDN for game assets
const GBF_CDN = 'https://prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/assets'

// Game element ID to name mapping (raw GBF data)
export const GAME_ELEMENT_NAMES = {
  1: 'Fire',
  2: 'Water',
  3: 'Earth',
  4: 'Wind',
  5: 'Light',
  6: 'Dark'
}

// Game proficiency ID to name mapping (raw GBF data)
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

// Game series_id to name mapping for characters (raw GBF data)
const GAME_CHARACTER_SERIES_NAMES = {
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

// Game series_id to name mapping for weapons (raw GBF data)
const GAME_WEAPON_SERIES_NAMES = {
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

// Game series_id to name mapping for summons (raw GBF data)
const GAME_SUMMON_SERIES_NAMES = {
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

/**
 * Render database detail view (single character/weapon/summon)
 */
export function renderDatabaseDetail(container, dataType, data) {
  const id = data.id || data.master?.id
  const name = data.name || data.master?.name || 'Unknown'
  const element = data.attribute || data.element || data.master?.attribute || data.master?.element

  let imageUrl = ''
  let fallbackUrl = ''
  let imageClass = ''

  // Use GBF's CDN since these are new items not yet on our S3
  if (dataType.startsWith('detail_npc')) {
    imageUrl = `${GBF_CDN}/npc/m/${id}_01.jpg`
    fallbackUrl = `${GBF_CDN}/npc/m/${id}_01_0.jpg`
    imageClass = 'character-main'
  } else if (dataType.startsWith('detail_weapon')) {
    imageUrl = `${GBF_CDN}/weapon/m/${id}.jpg`
    imageClass = 'weapon-main'
  } else if (dataType.startsWith('detail_summon')) {
    imageUrl = `${GBF_CDN}/summon/m/${id}.jpg`
    imageClass = 'summon-main'
  }

  const fallbackAttr = fallbackUrl ? `onerror="this.onerror=null; this.src='${fallbackUrl}'"` : ''

  let html = `
    <div class="database-detail">
      <div class="database-detail-image ${imageClass}">
        <img src="${imageUrl}" alt="${name}" ${fallbackAttr}>
      </div>
      <div class="database-detail-info">
  `

  // Proficiency is in specialty_weapon array for all types
  const proficiencies = data.master?.specialty_weapon || data.specialty_weapon || []

  if (dataType.startsWith('detail_npc')) {
    html += renderCharacterStats(data, name, id, element, proficiencies)
  } else if (dataType.startsWith('detail_weapon')) {
    html += renderWeaponStats(data, name, id, element, proficiencies[0])
  } else if (dataType.startsWith('detail_summon')) {
    html += renderSummonStats(data, name, id, element)
  }

  html += `
      </div>
    </div>
  `

  container.innerHTML = html
}

/**
 * Render character stats section
 */
function renderCharacterStats(data, name, id, element, proficiencies = []) {
  const master = data.master || data
  const param = data.param || {}

  const ringed = param.has_npcaugment_constant

  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'

  html += `<div class="stat-row"><span class="stat-label">Name</span><span class="stat-value">${name}</span></div>`

  if (id) {
    html += `<div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${id}</span></div>`
  }

  const seriesId = data.series_id || master.series_id
  if (seriesId && GAME_CHARACTER_SERIES_NAMES[seriesId]) {
    html += `<div class="stat-row"><span class="stat-label">Series</span><span class="stat-value">${GAME_CHARACTER_SERIES_NAMES[seriesId]}</span></div>`
  }

  if (element && GAME_ELEMENT_NAMES[element]) {
    html += `<div class="stat-row"><span class="stat-label">Element</span><span class="stat-value"><img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="${GAME_ELEMENT_NAMES[element]}"></span></div>`
  }

  if (proficiencies.length > 0) {
    const profIcons = proficiencies
      .filter(p => GAME_PROFICIENCY_NAMES[p])
      .map(p => `<img class="stat-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[p]}.png`)}" alt="${GAME_PROFICIENCY_NAMES[p]}">`)
      .join('')
    if (profIcons) {
      html += `<div class="stat-row"><span class="stat-label">Proficiency</span><span class="stat-value">${profIcons}</span></div>`
    }
  }

  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Uncap</span><span class="stat-value">${renderCharacterStars(level)}</span></div>`
  }

  if (minHp) {
    html += `<div class="stat-row"><span class="stat-label">Min HP</span><span class="stat-value">${Number(minHp).toLocaleString()}</span></div>`
  }
  if (maxHp) {
    html += `<div class="stat-row"><span class="stat-label">Max HP</span><span class="stat-value">${Number(maxHp).toLocaleString()}</span></div>`
  }
  if (minAtk) {
    html += `<div class="stat-row"><span class="stat-label">Min ATK</span><span class="stat-value">${Number(minAtk).toLocaleString()}</span></div>`
  }
  if (maxAtk) {
    html += `<div class="stat-row"><span class="stat-label">Max ATK</span><span class="stat-value">${Number(maxAtk).toLocaleString()}</span></div>`
  }
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Max Level</span><span class="stat-value">${level}</span></div>`
  }
  if (ringed) {
    html += `<div class="stat-row"><span class="stat-label">Perpetuity Ring</span><span class="stat-value">✓</span></div>`
  }

  const comment = data.comment || master.comment
  if (comment) {
    html += `<div class="stat-row stat-comment"><span class="stat-value">${comment}</span></div>`
  }

  html += '</div>'
  return html
}

/**
 * Render weapon stats section
 */
function renderWeaponStats(data, name, id, element, proficiency) {
  const master = data.master || data
  const param = data.param || {}

  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'

  html += `<div class="stat-row"><span class="stat-label">Name</span><span class="stat-value">${name}</span></div>`

  if (id) {
    html += `<div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${id}</span></div>`
  }

  const seriesId = data.series_id || master.series_id
  if (seriesId && GAME_WEAPON_SERIES_NAMES[seriesId]) {
    html += `<div class="stat-row"><span class="stat-label">Series</span><span class="stat-value">${GAME_WEAPON_SERIES_NAMES[seriesId]}</span></div>`
  }

  if (element && GAME_ELEMENT_NAMES[element]) {
    html += `<div class="stat-row"><span class="stat-label">Element</span><span class="stat-value"><img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="${GAME_ELEMENT_NAMES[element]}"></span></div>`
  }

  if (proficiency && GAME_PROFICIENCY_NAMES[proficiency]) {
    html += `<div class="stat-row"><span class="stat-label">Proficiency</span><span class="stat-value"><img class="stat-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[proficiency]}.png`)}" alt="${GAME_PROFICIENCY_NAMES[proficiency]}"></span></div>`
  }

  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Uncap</span><span class="stat-value">${renderWeaponStars(level)}</span></div>`
  }

  if (minHp) {
    html += `<div class="stat-row"><span class="stat-label">Min HP</span><span class="stat-value">${Number(minHp).toLocaleString()}</span></div>`
  }
  if (maxHp) {
    html += `<div class="stat-row"><span class="stat-label">Max HP</span><span class="stat-value">${Number(maxHp).toLocaleString()}</span></div>`
  }
  if (minAtk) {
    html += `<div class="stat-row"><span class="stat-label">Min ATK</span><span class="stat-value">${Number(minAtk).toLocaleString()}</span></div>`
  }
  if (maxAtk) {
    html += `<div class="stat-row"><span class="stat-label">Max ATK</span><span class="stat-value">${Number(maxAtk).toLocaleString()}</span></div>`
  }
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Max Level</span><span class="stat-value">${level}</span></div>`
  }

  const arousal = param.arousal
  if (arousal?.is_arousal_weapon) {
    html += `<div class="stat-row"><span class="stat-label">Awakening</span><span class="stat-value">${arousal.form_name || 'Attack'} Lv.${arousal.level || 1}</span></div>`
  }

  const axSkills = param.augment_skill_info?.[0]
  if (axSkills && Object.keys(axSkills).length > 0) {
    const axCount = Object.keys(axSkills).length
    html += `<div class="stat-row"><span class="stat-label">AX Skills</span><span class="stat-value">${axCount} skill${axCount > 1 ? 's' : ''}</span></div>`
  }

  const comment = data.comment || master.comment
  if (comment) {
    html += `<div class="stat-row stat-comment"><span class="stat-value">${comment}</span></div>`
  }

  html += '</div>'
  return html
}

/**
 * Render summon stats section
 */
function renderSummonStats(data, name, id, element) {
  const master = data.master || data
  const param = data.param || {}

  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'

  html += `<div class="stat-row"><span class="stat-label">Name</span><span class="stat-value">${name}</span></div>`

  if (id) {
    html += `<div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${id}</span></div>`
  }

  const seriesId = data.series_id || master.series_id
  if (seriesId && GAME_SUMMON_SERIES_NAMES[seriesId]) {
    html += `<div class="stat-row"><span class="stat-label">Series</span><span class="stat-value">${GAME_SUMMON_SERIES_NAMES[seriesId]}</span></div>`
  }

  if (element && GAME_ELEMENT_NAMES[element]) {
    html += `<div class="stat-row"><span class="stat-label">Element</span><span class="stat-value"><img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="${GAME_ELEMENT_NAMES[element]}"></span></div>`
  }

  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Uncap</span><span class="stat-value">${renderSummonStars(level)}</span></div>`
  }

  if (minHp) {
    html += `<div class="stat-row"><span class="stat-label">Min HP</span><span class="stat-value">${Number(minHp).toLocaleString()}</span></div>`
  }
  if (maxHp) {
    html += `<div class="stat-row"><span class="stat-label">Max HP</span><span class="stat-value">${Number(maxHp).toLocaleString()}</span></div>`
  }
  if (minAtk) {
    html += `<div class="stat-row"><span class="stat-label">Min ATK</span><span class="stat-value">${Number(minAtk).toLocaleString()}</span></div>`
  }
  if (maxAtk) {
    html += `<div class="stat-row"><span class="stat-label">Max ATK</span><span class="stat-value">${Number(maxAtk).toLocaleString()}</span></div>`
  }
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Max Level</span><span class="stat-value">${level}</span></div>`
  }

  const subAura = data.sub_skill?.name
  if (subAura) {
    html += `<div class="stat-row"><span class="stat-label">Sub Aura</span><span class="stat-value">${subAura}</span></div>`
  }

  const comment = data.comment || master.comment
  if (comment) {
    html += `<div class="stat-row stat-comment"><span class="stat-value">${comment}</span></div>`
  }

  html += '</div>'
  return html
}

/**
 * Render uncap stars for characters based on max level
 */
function renderCharacterStars(maxLevel) {
  let html = '<span class="stars">'

  for (let i = 0; i < 4; i++) {
    html += '<span class="star filled"></span>'
  }

  if (maxLevel >= 100) {
    html += '<span class="star flb"></span>'
  }

  if (maxLevel >= 150) {
    html += '<span class="star ulb"></span>'
  }

  html += '</span>'
  return html
}

/**
 * Render uncap stars for weapons based on max level
 */
function renderWeaponStars(maxLevel) {
  let html = '<span class="stars">'

  for (let i = 0; i < 3; i++) {
    html += '<span class="star filled"></span>'
  }

  if (maxLevel >= 150) {
    html += '<span class="star flb"></span>'
  }

  if (maxLevel >= 200) {
    html += '<span class="star flb"></span>'
  }

  if (maxLevel >= 250) {
    html += '<span class="star ulb"></span>'
  }

  html += '</span>'
  return html
}

/**
 * Render uncap stars for summons based on max level
 */
function renderSummonStars(maxLevel) {
  let html = '<span class="stars">'

  for (let i = 0; i < 3; i++) {
    html += '<span class="star filled"></span>'
  }

  if (maxLevel >= 150) {
    html += '<span class="star flb"></span>'
  }

  if (maxLevel >= 200) {
    html += '<span class="star flb"></span>'
  }

  if (maxLevel >= 250) {
    html += '<span class="star ulb"></span>'
  }

  html += '</span>'
  return html
}
