/**
 * @fileoverview Pure rendering functions for detail views.
 * These functions take data and return HTML strings, with no popup state dependencies.
 */

import { getImageUrl, GBF_CDN } from './constants.js'
import {
  GAME_ELEMENT_NAMES, GAME_PROFICIENCY_NAMES,
  GAME_CHARACTER_SERIES_NAMES, GAME_WEAPON_SERIES_NAMES, GAME_SUMMON_SERIES_NAMES,
  WEAPON_AWAKENING_ICONS, WEAPON_KEY_SERIES, CHARACTER_AWAKENING_MAPPING,
  AUGMENT_ICON_MAP
} from './game-data.js'
import { t, translateSeries } from './i18n.js'

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
      ...toArray(pc.summons),
      ...toArray(pc.sub_summons)
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

/**
 * Get the character image suffix from game data.
 * Game uses _st2 for style change; S3 stores as _style.
 * Falls back to _01 if no image_id_3 is available.
 */
/**
 * Get character pose suffix based on uncap level and transcendence.
 * _01: base (0-2 stars), _02: MLB (3+ stars), _03: FLB (5+ stars), _04: transcendence
 */
function getCharacterPose(uncapLevel, transcendenceStep) {
  if (transcendenceStep && transcendenceStep > 0) return '_04'
  if (uncapLevel && uncapLevel >= 5) return '_03'
  if (uncapLevel && uncapLevel > 2) return '_02'
  return '_01'
}

function getCharacterImageSuffix(item) {
  if (item.param?.style === '2') return '_01_style'
  const evolution = item.param?.evolution
  const phase = item.param?.phase
  return getCharacterPose(evolution, phase)
}

/**
 * Get image suffix from param.image_id for weapons/summons.
 * The game API includes the art variant in image_id (e.g. '1040301005_03').
 * Returns the suffix (e.g. '_03') or empty string for base art.
 */
function getImageSuffix(item) {
  const imageId = item.param?.image_id
  if (!imageId) return ''

  const id = item.master?.id || item.param?.id || item.id
  if (!id || !imageId.startsWith(String(id))) return ''

  return imageId.slice(String(id).length)
}

export function getItemImageUrl(dataType, item) {
  const granblueId = item.master?.id || item.param?.id || item.id

  if (dataType.includes('npc') || dataType.includes('character')) {
    const suffix = getCharacterImageSuffix(item)
    return getImageUrl(`character-square/${granblueId}${suffix}.jpg`)
  }
  if (dataType.includes('weapon')) {
    const suffix = getImageSuffix(item)
    return getImageUrl(`weapon-square/${granblueId}${suffix}.jpg`)
  }
  if (dataType.includes('summon')) {
    const suffix = getImageSuffix(item)
    return getImageUrl(`summon-square/${granblueId}${suffix}.jpg`)
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
    <img class="perpetuity-ring" src="icons/perpetuity/filled.svg" alt="${t('stat_perpetuity_ring')}" title="${t('stat_perpetuity_ring')}">
  </div>`
}

export function getWeaponModifiers(item, weaponKeyMap = null) {
  const param = item.param || {}
  const odiant = param.odiant || {}
  const isOdiant = odiant.is_odiant_weapon === true

  // Extract weapon key slugs if this is a special series weapon
  const weaponKeys = []
  if (weaponKeyMap) {
    const seriesId = parseInt(item.master?.series_id)
    if (WEAPON_KEY_SERIES.has(seriesId)) {
      const weaponProficiency = parseInt(item.master?.kind) || null
      for (const skillKey of ['skill1', 'skill2', 'skill3']) {
        const skillId = item[skillKey]?.id
        if (skillId && weaponKeyMap[skillId]) {
          const slug = weaponKeyMap[skillId]
          // Only slot 0 Gauph keys have proficiency-specific image variants
          const GAUPH_SLOT0 = ['gauph-courage', 'gauph-strength', 'gauph-strife', 'gauph-vitality', 'gauph-will', 'gauph-zeal']
          const needsSuffix = GAUPH_SLOT0.includes(slug) && weaponProficiency
          weaponKeys.push(needsSuffix ? `${slug}-${weaponProficiency}` : slug)
        }
      }
    }
  }

  return {
    awakening: param.arousal?.is_arousal_weapon ? param.arousal : null,
    axSkill: !isOdiant && param.augment_skill_info?.[0] ? {
      skill: param.augment_skill_info[0],
      iconImage: param.augment_skill_icon_image?.[0] || null
    } : null,
    befoulment: isOdiant ? {
      skill: param.augment_skill_info?.[0]?.[0] || null,
      exorcismLevel: odiant.exorcision_level || 0,
      maxExorcismLevel: odiant.max_exorcision_level || 5,
      iconImage: param.augment_skill_icon_image?.[0] || null
    } : null,
    weaponKeys
  }
}

export function renderWeaponModifiers(item, weaponKeyMap = null) {
  const mods = getWeaponModifiers(item, weaponKeyMap)
  if (!mods.awakening && !mods.axSkill && !mods.befoulment && mods.weaponKeys.length === 0) return ''

  let html = '<div class="weapon-modifiers">'

  if (mods.awakening) {
    const iconName = WEAPON_AWAKENING_ICONS[mods.awakening.form_name] || 'weapon-atk'
    html += `<img class="awakening-icon" src="${getImageUrl(`awakening/${iconName}.png`)}" alt="${t('stat_awakening')}" title="${mods.awakening.form_name} Lv.${mods.awakening.level}">`
  }

  const hasSkills = mods.axSkill || mods.befoulment || mods.weaponKeys.length > 0
  if (hasSkills) {
    html += '<div class="weapon-skills">'

    if (mods.axSkill) {
      const iconSlug = mods.axSkill.iconImage || 'ex_skill_atk'
      const iconFile = AUGMENT_ICON_MAP[iconSlug] || 'ax_atk'
      html += `<img class="ax-skill-icon" src="${getImageUrl(`ax/${iconFile}.png`)}" alt="${t('stat_ax_skills')}" title="${t('stat_ax_skills')}">`
    }

    if (mods.befoulment) {
      const skill = mods.befoulment.skill
      const exLevel = mods.befoulment.exorcismLevel
      const maxLevel = mods.befoulment.maxExorcismLevel
      const showValue = skill?.show_value || 'Befouled'
      const iconSlug = mods.befoulment.iconImage || 'ex_skill_def_down'
      const iconFile = AUGMENT_ICON_MAP[iconSlug] || 'befoul_def_down'
      html += `<img class="befoulment-icon" src="${getImageUrl(`ax/${iconFile}.png`)}" alt="${t('stat_befoulment')}" title="${t('stat_befoulment')}: ${showValue} (${t('stat_exorcism')} ${exLevel}/${maxLevel})">`
    }

    for (const slug of mods.weaponKeys) {
      html += `<img class="weapon-key-icon" src="${getImageUrl(`weapon-keys/${slug}.png`)}" alt="${slug}" title="${slug}">`
    }

    html += '</div>'
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
  html += statRow(t('stat_name'), name)
  if (id) html += statRow(t('stat_id'), id)

  const seriesId = data.series_id || master.series_id
  if (seriesId && seriesMap?.[seriesId]) {
    html += statRow(t('stat_series'), translateSeries(seriesMap[seriesId], type))
  }

  if (element && GAME_ELEMENT_NAMES[element]) {
    html += statRow(t('stat_element'), `<img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="${GAME_ELEMENT_NAMES[element]}">`)
  }

  if (proficiencies?.length > 0) {
    const profIcons = proficiencies
      .filter(p => GAME_PROFICIENCY_NAMES[p])
      .map(p => `<img class="stat-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[p]}.png`)}" alt="${GAME_PROFICIENCY_NAMES[p]}">`)
      .join('')
    if (profIcons) html += statRow(t('stat_proficiency'), profIcons)
  }

  if (level) html += statRow(t('stat_uncap'), renderStars(level, type))
  if (minHp) html += statRow(t('stat_min_hp'), Number(minHp).toLocaleString())
  if (maxHp) html += statRow(t('stat_max_hp'), Number(maxHp).toLocaleString())
  if (minAtk) html += statRow(t('stat_min_atk'), Number(minAtk).toLocaleString())
  if (maxAtk) html += statRow(t('stat_max_atk'), Number(maxAtk).toLocaleString())
  if (level) html += statRow(t('stat_max_level'), level)

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
    html += statRow(t('stat_perpetuity_ring'), '✓')
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
    html += statRow(t('stat_awakening'), `${arousal.form_name || 'Attack'} Lv.${arousal.level || 1}`)
  }

  const odiant = param.odiant
  if (odiant?.is_odiant_weapon) {
    const befoulSkill = param.augment_skill_info?.[0]?.[0]
    html += statRow(t('stat_befoulment'), befoulSkill?.show_value || 'Active')
    html += statRow(t('stat_exorcism'), `${odiant.exorcision_level || 0}/${odiant.max_exorcision_level || 5}`)
  } else {
    const axSkills = param.augment_skill_info?.[0]
    if (axSkills && Object.keys(axSkills).length > 0) {
      const axCount = Object.keys(axSkills).length
      html += statRow(t('stat_ax_skills'), `${axCount} skill${axCount > 1 ? 's' : ''}`)
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
    html += statRow(t('stat_sub_aura'), subAura)
  }

  return closeStats(html, data, master)
}

// ==========================================
// DETAIL VIEW RENDERERS
// ==========================================

export function renderPartyDetail(container, data, options = {}) {
  const deck = data.deck || {}
  const pc = deck.pc || {}
  const job = pc.job
  const characters = toArray(deck.npc).filter(Boolean)
  const weapons = toArray(pc.weapons).filter(Boolean)
  const summons = toArray(pc.summons).filter(Boolean)
  const subSummons = toArray(pc.sub_summons).filter(Boolean)
  const friendSummon = options.friendSummon || null
  const accessoryIds = [pc.familiar_id, pc.shield_id].filter(Boolean)
  const weaponKeyMap = options.weaponKeyMap || null
  const quickSummonId = pc.quick_user_summon_id
  const setAction = pc.set_action || []
  const jobSkillSlugs = options.jobSkillSlugs || {}

  let html = ''

  if (job?.master?.id || accessoryIds.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">${t('party_section_job')}</h3>
        <div class="job-row">
          ${job?.master?.id ? `
            <div class="wide-item">
              <img src="${getImageUrl(`job-wide/${job.master.id}_a.jpg`)}" alt="${job.master.name || t('party_section_job')}">
            </div>
          ` : ''}
          ${accessoryIds.map(id => `
            <div class="grid-item">
              <img src="${getImageUrl(`accessory-square/${id}.jpg`)}" alt="">
            </div>
          `).join('')}
        </div>
        ${setAction.length > 0 ? `
          <div class="job-skills-list">
            ${setAction.map(skill => {
              const slug = jobSkillSlugs[skill.name]
              const iconUrl = slug ? getImageUrl(`job-skills/${slug}.png`) : null
              return `
                <div class="job-skill-item">
                  ${iconUrl ? `<img src="${iconUrl}" alt="${skill.name}">` : '<div class="job-skill-placeholder"></div>'}
                  <span>${skill.name}</span>
                </div>
              `
            }).join('')}
          </div>
        ` : ''}
      </div>
    `
  }

  if (characters.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">${t('party_section_characters')}</h3>
        <div class="character-grid">
          ${characters.map(item => {
            const id = item.master?.id || item.param?.id || item.id
            const suffix = getCharacterImageSuffix(item)
            const imageUrl = getImageUrl(`character-main/${id}${suffix}.jpg`)
            const arousalForm = item.param?.npc_arousal_form
            const awakeningSlug = arousalForm ? CHARACTER_AWAKENING_MAPPING[arousalForm] : null
            const hasPerpetuit = !!item.param?.has_npcaugment_constant
            const hasModifiers = (awakeningSlug && awakeningSlug !== 'character-balanced') || hasPerpetuit
            const modifiersHtml = hasModifiers ? `
              <div class="char-modifiers">
                ${hasPerpetuit ? `<img class="perpetuity-ring" src="icons/perpetuity/filled.svg" alt="${t('stat_perpetuity_ring')}" title="${t('stat_perpetuity_ring')}">` : ''}
                ${awakeningSlug && awakeningSlug !== 'character-balanced' ? `<img class="awakening-icon" src="${getImageUrl(`awakening/${awakeningSlug}.jpg`)}" alt="${t('stat_awakening')}" title="${t('stat_awakening')}">` : ''}
              </div>
            ` : ''
            return `
              <div class="grid-item">
                ${modifiersHtml}
                <img src="${imageUrl}" alt="">
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  if (weapons.length > 0) {
    const [mainhand, ...gridWeapons] = weapons
    const mainhandId = mainhand.master?.id || mainhand.param?.id || mainhand.id
    const mainhandSuffix = getImageSuffix(mainhand)
    html += `
      <div class="party-section">
        <h3 class="party-section-title">${t('party_section_weapons')}</h3>
        <div class="weapon-layout">
          <div class="weapon-mainhand">
            ${renderWeaponModifiers(mainhand, weaponKeyMap)}
            <img src="${getImageUrl(`weapon-main/${mainhandId}${mainhandSuffix}.jpg`)}" alt="">
          </div>
          <div class="weapon-grid">
            ${gridWeapons.map(item => {
              const id = item.master?.id || item.param?.id || item.id
              const suffix = getImageSuffix(item)
              return `
                <div class="grid-item">
                  ${renderWeaponModifiers(item, weaponKeyMap)}
                  <img src="${getImageUrl(`weapon-grid/${id}${suffix}.jpg`)}" alt="">
                </div>
              `
            }).join('')}
          </div>
        </div>
      </div>
    `
  }

  if (summons.length > 0 || subSummons.length > 0 || friendSummon) {
    const [mainSummon, ...otherSummons] = summons
    const allSubSummons = [...otherSummons, ...subSummons]

    html += `
      <div class="party-section">
        <h3 class="party-section-title">${t('party_section_summons')}</h3>
        <div class="summon-layout">
          ${mainSummon ? (() => {
            const id = mainSummon.master?.id || mainSummon.param?.id || mainSummon.id
            const suffix = getImageSuffix(mainSummon)
            return `
              <div class="summon-main">
                <img src="${getImageUrl(`summon-tall/${id}${suffix}.jpg`)}" alt="">
              </div>
            `
          })() : ''}
          <div class="summon-grid">
            ${allSubSummons.map(item => {
              const id = item.master?.id || item.param?.id || item.id
              const suffix = getImageSuffix(item)
              const isQuickSummon = quickSummonId && String(item.param?.id) === String(quickSummonId)
              return `
                <div class="grid-item">
                  ${isQuickSummon ? `<div class="summon-modifiers"><img class="quick-summon-badge" src="icons/quick-summon/filled.svg" alt="${t('stat_quick_summon')}" title="${t('stat_quick_summon')}"></div>` : ''}
                  <img src="${getImageUrl(`summon-grid/${id}${suffix}.jpg`)}" alt="">
                </div>
              `
            }).join('')}
          </div>
          ${friendSummon ? `
            <div class="summon-friend">
              <img src="${getImageUrl(`summon-tall/${friendSummon.granblue_id}${friendSummon.imageSuffix || ''}.jpg`)}" alt="">
            </div>
          ` : ''}
        </div>
      </div>
    `
  }


  const bulletInfo = data.bullet_info?.set_bullets
  if (bulletInfo) {
    const bullets = Object.entries(bulletInfo)
      .filter(([key]) => key.startsWith('bullet_'))
      .map(([, bullet]) => bullet)
      .filter(b => b && b.bullet_id)

    if (bullets.length > 0) {
      html += `
        <div class="party-section">
          <h3 class="party-section-title">${t('count_bullets', { count: bullets.length })}</h3>
          <div class="item-grid bullets">
            ${bullets.map(bullet => {
              const imageUrl = getImageUrl(`bullet-square/${bullet.bullet_id}.jpg`)
              return `
                <div class="grid-item" title="${bullet.name || ''}">
                  <img src="${imageUrl}" alt="${bullet.name || ''}">
                </div>
              `
            }).join('')}
          </div>
        </div>
      `
    }
  }

  container.innerHTML = html || `<p class="cache-empty">${t('party_no_data')}</p>`
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
