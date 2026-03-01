/**
 * @fileoverview Pure rendering functions for detail views.
 * These functions take data and return HTML strings, with no popup state dependencies.
 */

import { getImageUrl, GBF_CDN } from './constants.js'
import {
  GAME_ELEMENT_NAMES, GAME_PROFICIENCY_NAMES,
  GAME_CHARACTER_SERIES_NAMES, GAME_WEAPON_SERIES_NAMES, GAME_SUMMON_SERIES_NAMES,
  WEAPON_AWAKENING_ICONS
} from './game-data.js'

// ==========================================
// DATA TYPE HELPERS
// ==========================================

export function isCollectionType(dataType) {
  return dataType.startsWith('collection_') || dataType.startsWith('list_') || dataType.startsWith('stash_') || dataType === 'character_stats'
}

export function isDatabaseDetailType(dataType) {
  return dataType.startsWith('detail_')
}

export function isWeaponOrSummonCollection(dataType) {
  return dataType === 'collection_weapon' || dataType === 'collection_summon' ||
         dataType === 'list_weapon' || dataType === 'list_summon' ||
         dataType.startsWith('stash_weapon') || dataType.startsWith('stash_summon')
}

// ==========================================
// DATA EXTRACTION
// ==========================================

export function toArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  return Object.values(data)
}

export function extractItems(dataType, data) {
  if (dataType.startsWith('collection_') || dataType.startsWith('list_') || dataType.startsWith('stash_')) {
    const pages = Object.values(data)
    return pages.flatMap(page => page.list || [])
  }
  if (dataType.startsWith('party_')) {
    const deck = data.deck || {}
    const pc = deck.pc || {}
    return [
      ...toArray(deck.npc),
      ...toArray(pc.weapons),
      ...toArray(pc.summons)
    ].filter(Boolean)
  }
  return [data]
}

export function countItems(dataType, data) {
  return extractItems(dataType, data).length
}

// ==========================================
// IMAGE & LABEL HELPERS
// ==========================================

export function getItemImageUrl(dataType, item) {
  const granblueId = item.master?.id || item.param?.id || item.id

  if (dataType.includes('npc') || dataType.includes('character')) {
    return getImageUrl(`character-square/${granblueId}_01.jpg`)
  }
  if (dataType.includes('weapon')) {
    return getImageUrl(`weapon-square/${granblueId}.jpg`)
  }
  if (dataType.includes('summon')) {
    return getImageUrl(`summon-square/${granblueId}.jpg`)
  }
  if (dataType.includes('artifact')) {
    const artifactId = item.artifact_id || granblueId
    return getImageUrl(`artifact-square/${artifactId}.jpg`)
  }
  return ''
}

export function getArtifactLabels(item) {
  const element = item.attribute || item.element
  const proficiency = item.kind || item.weapon_kind

  let html = '<div class="list-item-labels">'

  if (element && GAME_ELEMENT_NAMES[element]) {
    html += `<img class="label-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="">`
  }

  if (proficiency && GAME_PROFICIENCY_NAMES[proficiency]) {
    html += `<img class="label-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[proficiency]}.png`)}" alt="">`
  }

  html += '</div>'
  return html
}

export function getGridClass(dataType) {
  if (dataType.includes('artifact')) return 'artifacts'
  if (dataType.includes('npc') || dataType.includes('character')) return 'characters'
  if (dataType.includes('weapon')) return 'weapons'
  if (dataType.includes('summon')) return 'summons'
  return ''
}

// ==========================================
// MODIFIER HELPERS
// ==========================================

export function getCharacterModifiers(item) {
  const param = item.param || {}
  return {
    perpetuity: !!param.has_npcaugment_constant
  }
}

export function renderCharacterModifiers(item) {
  const mods = getCharacterModifiers(item)
  if (!mods.perpetuity) return ''

  return `<div class="char-modifiers">
    <img class="perpetuity-ring" src="icons/perpetuity/filled.svg" alt="Perpetuity Ring" title="Perpetuity Ring">
  </div>`
}

export function getWeaponModifiers(item) {
  const param = item.param || {}
  const odiant = param.odiant || {}
  const isOdiant = odiant.is_odiant_weapon === true

  return {
    awakening: param.arousal?.is_arousal_weapon ? param.arousal : null,
    axSkill: !isOdiant ? param.augment_skill_info?.[0] || null : null,
    befoulment: isOdiant ? {
      skill: param.augment_skill_info?.[0]?.[0] || null,
      exorcismLevel: odiant.exorcision_level || 0,
      maxExorcismLevel: odiant.max_exorcision_level || 5,
      iconImage: param.augment_skill_icon_image?.[0] || null
    } : null
  }
}

export function renderWeaponModifiers(item) {
  const mods = getWeaponModifiers(item)
  if (!mods.awakening && !mods.axSkill && !mods.befoulment) return ''

  let html = '<div class="weapon-modifiers">'

  if (mods.awakening) {
    const iconName = WEAPON_AWAKENING_ICONS[mods.awakening.form_name] || 'weapon-atk'
    html += `<img class="awakening-icon" src="${getImageUrl(`awakening/${iconName}.png`)}" alt="Awakening" title="${mods.awakening.form_name} Lv.${mods.awakening.level}">`
  }

  if (mods.axSkill) {
    html += `<img class="ax-skill-icon" src="${getImageUrl('ax/atk.png')}" alt="AX Skill" title="AX Skill">`
  }

  if (mods.befoulment) {
    const skill = mods.befoulment.skill
    const exLevel = mods.befoulment.exorcismLevel
    const maxLevel = mods.befoulment.maxExorcismLevel
    const showValue = skill?.show_value || 'Befouled'
    const iconImage = mods.befoulment.iconImage || 'ex_skill_def_down'
    html += `<img class="befoulment-icon" src="${getImageUrl(`ax/${iconImage}.png`)}" alt="Befoulment" title="Befoulment: ${showValue} (Exorcism ${exLevel}/${maxLevel})">`
  }

  html += '</div>'
  return html
}

// ==========================================
// STAT RENDERING
// ==========================================

function statRow(label, value) {
  return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`
}

const STAR_CONFIGS = {
  character: { base: 4, tiers: [{ level: 100, cls: 'flb' }, { level: 150, cls: 'ulb' }] },
  weapon:    { base: 3, tiers: [{ level: 150, cls: 'flb' }, { level: 200, cls: 'flb' }, { level: 250, cls: 'ulb' }] },
  summon:    { base: 3, tiers: [{ level: 150, cls: 'flb' }, { level: 200, cls: 'flb' }, { level: 250, cls: 'ulb' }] }
}

export function renderStars(maxLevel, type) {
  const config = STAR_CONFIGS[type]
  let html = '<span class="stars">'
  for (let i = 0; i < config.base; i++) html += '<span class="star filled"></span>'
  for (const tier of config.tiers) {
    if (maxLevel >= tier.level) html += `<span class="star ${tier.cls}"></span>`
  }
  html += '</span>'
  return html
}

function renderBaseStats({ data, name, id, seriesMap, element, proficiencies, type }) {
  const master = data.master || data
  const param = data.param || {}

  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'
  html += statRow('Name', name)
  if (id) html += statRow('ID', id)

  const seriesId = data.series_id || master.series_id
  if (seriesId && seriesMap?.[seriesId]) {
    html += statRow('Series', seriesMap[seriesId])
  }

  if (element && GAME_ELEMENT_NAMES[element]) {
    html += statRow('Element', `<img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="${GAME_ELEMENT_NAMES[element]}">`)
  }

  if (proficiencies?.length > 0) {
    const profIcons = proficiencies
      .filter(p => GAME_PROFICIENCY_NAMES[p])
      .map(p => `<img class="stat-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[p]}.png`)}" alt="${GAME_PROFICIENCY_NAMES[p]}">`)
      .join('')
    if (profIcons) html += statRow('Proficiency', profIcons)
  }

  if (level) html += statRow('Uncap', renderStars(level, type))
  if (minHp) html += statRow('Min HP', Number(minHp).toLocaleString())
  if (maxHp) html += statRow('Max HP', Number(maxHp).toLocaleString())
  if (minAtk) html += statRow('Min ATK', Number(minAtk).toLocaleString())
  if (maxAtk) html += statRow('Max ATK', Number(maxAtk).toLocaleString())
  if (level) html += statRow('Max Level', level)

  return { html, master, param }
}

function closeStats(html, data, master) {
  const comment = data.comment || master.comment
  if (comment) {
    html += `<div class="stat-row stat-comment"><span class="stat-value">${comment}</span></div>`
  }
  return html + '</div>'
}

export function renderCharacterStats(data, name, id, element, proficiencies = []) {
  const { html: base, param, master } = renderBaseStats({
    data, name, id, element, proficiencies,
    seriesMap: GAME_CHARACTER_SERIES_NAMES,
    type: 'character'
  })
  let html = base

  if (param.has_npcaugment_constant) {
    html += statRow('Perpetuity Ring', '✓')
  }

  return closeStats(html, data, master)
}

export function renderWeaponStats(data, name, id, element, proficiency) {
  const { html: base, param, master } = renderBaseStats({
    data, name, id, element,
    proficiencies: proficiency ? [proficiency] : [],
    seriesMap: GAME_WEAPON_SERIES_NAMES,
    type: 'weapon'
  })
  let html = base

  const arousal = param.arousal
  if (arousal?.is_arousal_weapon) {
    html += statRow('Awakening', `${arousal.form_name || 'Attack'} Lv.${arousal.level || 1}`)
  }

  const odiant = param.odiant
  if (odiant?.is_odiant_weapon) {
    const befoulSkill = param.augment_skill_info?.[0]?.[0]
    html += statRow('Befoulment', befoulSkill?.show_value || 'Active')
    html += statRow('Exorcism', `${odiant.exorcision_level || 0}/${odiant.max_exorcision_level || 5}`)
  } else {
    const axSkills = param.augment_skill_info?.[0]
    if (axSkills && Object.keys(axSkills).length > 0) {
      const axCount = Object.keys(axSkills).length
      html += statRow('AX Skills', `${axCount} skill${axCount > 1 ? 's' : ''}`)
    }
  }

  return closeStats(html, data, master)
}

export function renderSummonStats(data, name, id, element) {
  const { html: base, master } = renderBaseStats({
    data, name, id, element,
    seriesMap: GAME_SUMMON_SERIES_NAMES,
    type: 'summon'
  })
  let html = base

  const subAura = data.sub_skill?.name
  if (subAura) {
    html += statRow('Sub Aura', subAura)
  }

  return closeStats(html, data, master)
}

// ==========================================
// DETAIL VIEW RENDERERS
// ==========================================

export function renderPartyDetail(container, data) {
  const deck = data.deck || {}
  const pc = deck.pc || {}
  const job = pc.job
  const characters = toArray(deck.npc).filter(Boolean)
  const weapons = toArray(pc.weapons).filter(Boolean)
  const summons = toArray(pc.summons).filter(Boolean)
  const accessoryIds = [pc.familiar_id, pc.shield_id].filter(Boolean)

  let html = ''

  if (job?.master?.id) {
    const jobId = job.master.id
    const jobName = job.master.name || 'Job'
    const jobImageUrl = getImageUrl(`job-wide/${jobId}_a.jpg`)
    html += `
      <div class="party-section">
        <h3 class="party-section-title">Job</h3>
        <div class="wide-item">
          <img src="${jobImageUrl}" alt="${jobName}">
        </div>
      </div>
    `
  }

  if (characters.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">Characters</h3>
        <div class="item-grid characters">
          ${characters.map(item => {
            const id = item.master?.id || item.param?.id || item.id
            const imageUrl = getImageUrl(`character-grid/${id}_01.jpg`)
            return `
              <div class="grid-item">
                <img src="${imageUrl}" alt="">
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  if (weapons.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">Weapons</h3>
        <div class="item-grid weapons">
          ${weapons.map(item => {
            const id = item.master?.id || item.param?.id || item.id
            const imageUrl = getImageUrl(`weapon-grid/${id}.jpg`)
            return `
              <div class="grid-item">
                <img src="${imageUrl}" alt="">
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  if (summons.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">Summons</h3>
        <div class="item-grid summons">
          ${summons.map(item => {
            const id = item.master?.id || item.param?.id || item.id
            const imageUrl = getImageUrl(`summon-wide/${id}.jpg`)
            return `
              <div class="grid-item">
                <img src="${imageUrl}" alt="">
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  if (accessoryIds.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">Accessories</h3>
        <div class="item-grid accessories">
          ${accessoryIds.map(id => {
            const imageUrl = getImageUrl(`accessory-square/${id}.jpg`)
            return `
              <div class="grid-item">
                <img src="${imageUrl}" alt="">
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  container.innerHTML = html || '<p class="cache-empty">No party data</p>'
}

export function renderDatabaseDetail(container, dataType, data) {
  const id = data.id || data.master?.id
  const name = data.name || data.master?.name || 'Unknown'
  const element = data.attribute || data.element || data.master?.attribute || data.master?.element

  let imageUrl = ''
  let fallbackUrl = ''
  let imageClass = ''

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
