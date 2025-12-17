/**
 * @fileoverview Item rendering for grid and list views.
 */

import { getImageUrl } from "../constants.js"
import { renderDatabaseDetail, GAME_ELEMENT_NAMES, GAME_PROFICIENCY_NAMES } from "./database.js"
import {
  selectedItems,
  currentItemIndexMap,
  setItemIndexMap,
  setSelectedItems,
  toggleItemSelection,
  updateSelectionCount
} from "./selection.js"

// Checkmark SVG for checkboxes
export const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7139 4.04764C13.14 3.52854 13.0837 2.74594 12.5881 2.29964C12.0925 1.85335 11.3453 1.91237 10.9192 2.43147L5.28565 9.94404L3.02018 7.32366C2.55804 6.83959 1.80875 6.83959 1.34661 7.32366C0.884464 7.80772 0.884464 8.59255 1.34661 9.07662L4.50946 12.6369C4.9716 13.121 5.72089 13.121 6.18303 12.6369C6.2359 12.5816 6.28675 12.5271 6.33575 12.4674L12.7139 4.04764Z"/></svg>`

// Awakening form → image slug
const AWAKENING_FORM_MAPPING = {
  1: 'weapon-atk',
  2: 'weapon-def',
  3: 'weapon-special',
  4: 'weapon-ca',
  5: 'weapon-skill',
  6: 'weapon-heal'
}

// GBF skill_id → AX image slug
const AX_SKILL_MAPPING = {
  '1588': 'hp',
  '1589': 'atk',
  '1590': 'def',
  '1591': 'ca-dmg',
  '1592': 'ta',
  '1593': 'debuff',
  '1594': 'ele-atk',
  '1595': 'healing',
  '1596': 'da',
  '1597': 'ta',
  '1599': 'ca-cap',
  '1600': 'stamina',
  '1601': 'enmity',
  '1719': 'skill-supp',
  '1720': 'ca-supp',
  '1721': 'ele-def',
  '1722': 'na-cap'
}

// AX skill_id → display name (for tooltip)
const AX_SKILL_NAMES = {
  '1588': 'HP',
  '1589': 'ATK',
  '1590': 'DEF',
  '1591': 'C.A. DMG',
  '1592': 'Multiattack',
  '1593': 'Debuff Res',
  '1594': 'Ele ATK',
  '1595': 'Healing',
  '1596': 'DA Rate',
  '1597': 'TA Rate',
  '1599': 'C.A. Cap',
  '1600': 'Stamina',
  '1601': 'Enmity',
  '1719': 'Skill Supp',
  '1720': 'C.A. Supp',
  '1721': 'Ele DEF',
  '1722': 'NA Cap'
}

/**
 * Check if a data type is a collection type (supports item selection)
 */
export function isCollectionType(dataType) {
  return dataType.startsWith('collection_') || dataType.startsWith('list_')
}

/**
 * Check if a data type is a weapon or summon collection (supports Lv1 filter)
 */
export function isWeaponOrSummonCollection(dataType) {
  return dataType.includes('weapon') || dataType.includes('summon')
}

/**
 * Check if a data type is a database detail type
 */
export function isDatabaseDetailType(dataType) {
  return dataType.startsWith('detail_')
}

/**
 * Convert object or array to array (handles GBF's inconsistent data formats)
 */
export function toArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  return Object.values(data)
}

/**
 * Extract items from data based on type
 */
export function extractItems(dataType, data) {
  if (dataType.startsWith('collection_') || dataType.startsWith('list_')) {
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

/**
 * Get image URL for an item using siero-img S3 CDN
 */
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

/**
 * Get grid class based on data type
 */
export function getGridClass(dataType) {
  if (dataType.includes('artifact')) return 'artifacts'
  if (dataType.includes('npc') || dataType.includes('character')) return 'characters'
  if (dataType.includes('weapon')) return 'weapons'
  if (dataType.includes('summon')) return 'summons'
  return ''
}

/**
 * Get element and proficiency labels for an artifact
 */
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

/**
 * Get weapon modifier data (awakening, AX skills, keys)
 */
function getWeaponModifiers(item) {
  const param = item.param || {}
  const result = {
    awakening: null,
    axSkills: [],
    keys: []
  }

  // Awakening
  const arousal = param.arousal
  if (arousal?.is_arousal_weapon && arousal.form) {
    const slug = AWAKENING_FORM_MAPPING[arousal.form]
    if (slug) {
      result.awakening = {
        slug,
        level: arousal.level || 1,
        name: arousal.form_name || 'Attack'
      }
    }
  }

  // AX skills
  const axSkillInfo = param.augment_skill_info?.[0]
  if (Array.isArray(axSkillInfo)) {
    for (const skill of axSkillInfo) {
      const skillId = String(skill?.skill_id)
      const slug = AX_SKILL_MAPPING[skillId]
      const name = AX_SKILL_NAMES[skillId]
      if (slug) {
        result.axSkills.push({ slug, name: name || slug, value: skill.show_value })
      }
    }
  }

  // Weapon keys (party data only - skill1, skill2, skill3)
  for (const key of ['skill1', 'skill2', 'skill3']) {
    if (item[key]?.name) {
      result.keys.push({ name: item[key].name, id: item[key].id })
    }
  }

  return result
}

/**
 * Render weapon modifier overlays (awakening icon, AX skill icons) with tooltip
 */
function renderWeaponModifiers(item) {
  const mods = getWeaponModifiers(item)

  // Collect all skill icons (AX)
  const skillIcons = []
  const tooltipLines = []

  // Awakening tooltip line
  if (mods.awakening) {
    tooltipLines.push(`${mods.awakening.name} Lv.${mods.awakening.level}`)
  }

  for (const ax of mods.axSkills) {
    skillIcons.push(`<img class="skill" src="${getImageUrl(`ax/${ax.slug}.png`)}" alt="${ax.slug}">`)
    tooltipLines.push(`${ax.name} ${ax.value}`)
  }

  if (!mods.awakening && skillIcons.length === 0) return { html: '', tooltip: '', keys: mods.keys }

  let html = '<div class="modifiers">'

  if (mods.awakening) {
    html += `<img class="awakening" src="${getImageUrl(`awakening/${mods.awakening.slug}.png`)}" alt="${mods.awakening.name}">`
  }

  if (skillIcons.length > 0) {
    html += `<div class="skills">${skillIcons.join('')}</div>`
  }

  html += '</div>'

  // Tooltip HTML (shown on hover)
  const tooltip = tooltipLines.length > 0
    ? `<div class="weapon-tooltip">${tooltipLines.join('<br>')}</div>`
    : ''

  return { html, tooltip, keys: mods.keys }
}

/**
 * Render items in detail view
 * @param {string} dataType - The data type being rendered
 * @param {object} data - The data to render
 * @param {object} options - Rendering options
 * @param {Set} options.activeRarityFilters - Active rarity filters
 * @param {boolean} options.excludeLv1Items - Whether to exclude Lv1 items
 * @param {boolean} options.detailViewActive - Whether detail view is active
 */
export function renderDetailItems(dataType, data, options = {}) {
  const {
    activeRarityFilters = new Set(['4']),
    excludeLv1Items = false,
    detailViewActive = false
  } = options

  const container = document.getElementById('detailItems')

  // Party gets special sectioned layout
  if (dataType.startsWith('party_')) {
    renderPartyDetail(container, data)
    return
  }

  // Database detail items get their own layout
  if (isDatabaseDetailType(dataType)) {
    renderDatabaseDetail(container, dataType, data)
    return
  }

  const allItems = extractItems(dataType, data)
  const isCollection = isCollectionType(dataType)

  // Filter items by rarity if collection type
  let items = allItems
  let newItemIndexMap = []

  if (isCollection) {
    items = []
    allItems.forEach((item, originalIndex) => {
      const rarity = item.rarity || item.master?.rarity || item.param?.rarity
      if (!rarity || activeRarityFilters.has(String(rarity))) {
        newItemIndexMap.push(originalIndex)
        items.push(item)
      }
    })

    setItemIndexMap(newItemIndexMap)

    // Initialize selection for first render
    const isFirstRender = selectedItems.size === 0 || !detailViewActive
    if (isFirstRender) {
      const newSelectedItems = new Set()
      const shouldExcludeLv1 = excludeLv1Items && isWeaponOrSummonCollection(dataType)
      items.forEach((item, filteredIndex) => {
        const rarity = item.rarity || item.master?.rarity || item.param?.rarity
        if (String(rarity) === '4') {
          if (shouldExcludeLv1 && Number(item.param?.level) === 1) {
            // Don't pre-select Lv1 items
          } else {
            newSelectedItems.add(newItemIndexMap[filteredIndex])
          }
        }
      })
      setSelectedItems(newSelectedItems)
    }
  }

  const hasNames = items.some(item => item.name || item.master?.name)

  if (hasNames) {
    renderListLayout(container, items, dataType, isCollection, newItemIndexMap)
  } else {
    renderGridLayout(container, items, dataType, isCollection, newItemIndexMap)
  }

  // Add click handlers for selectable items
  if (isCollection) {
    attachSelectionHandlers(container)
  }

  // Update selection count display
  if (isCollection) {
    updateSelectionCount()
  }
}

/**
 * Render list layout with names
 */
function renderListLayout(container, items, dataType, isCollection, itemIndexMap) {
  container.innerHTML = `<div class="item-list">
    ${items.map((item, filteredIndex) => {
      const originalIndex = isCollection ? itemIndexMap[filteredIndex] : filteredIndex
      const isChecked = isCollection && selectedItems.has(originalIndex)
      const name = item.name || item.master?.name || ''
      const level = item.level || item.lv
      const levelText = level ? ` <span class="list-item-level">Lv.${level}</span>` : ''
      const checkboxHtml = isCollection ? `
        <label class="item-checkbox${isChecked ? ' checked' : ''}" data-index="${originalIndex}">
          <span class="checkbox-indicator">${CHECK_ICON}</span>
        </label>
      ` : ''
      return `
      <div class="list-item${isCollection ? ' selectable' : ''}" data-index="${originalIndex}">
        <img class="list-item-image" src="${getItemImageUrl(dataType, item)}" alt="">
        <div class="list-item-info">
          <span class="list-item-name">${name}${levelText}</span>
          ${dataType.includes('artifact') ? getArtifactLabels(item) : ''}
        </div>
        ${checkboxHtml}
      </div>
    `}).join('')}
  </div>${isCollection ? '<p class="collection-note">Navigate to the next page in-game to import more items</p>' : ''}`
}

/**
 * Render grid layout
 */
function renderGridLayout(container, items, dataType, isCollection, itemIndexMap) {
  const gridClass = getGridClass(dataType)
  const isWeaponType = dataType.includes('weapon')

  container.innerHTML = `<div class="item-grid ${gridClass} square-cells">
    ${items.map((item, filteredIndex) => {
      const originalIndex = isCollection ? itemIndexMap[filteredIndex] : filteredIndex
      const isChecked = isCollection && selectedItems.has(originalIndex)
      const checkboxHtml = isCollection ? `
        <label class="item-checkbox${isChecked ? ' checked' : ''}" data-index="${originalIndex}">
          <span class="checkbox-indicator">${CHECK_ICON}</span>
        </label>
      ` : ''

      // Weapon modifiers (awakening, AX skills)
      const modifiers = isWeaponType ? renderWeaponModifiers(item) : { html: '', tooltip: '' }
      const hasTooltip = modifiers.tooltip ? ' has-tooltip' : ''

      return `
      <div class="grid-item${isCollection ? ' selectable' : ''}${hasTooltip}" data-index="${originalIndex}">
        ${modifiers.html}
        <img src="${getItemImageUrl(dataType, item)}" alt="" draggable="false">
        ${modifiers.tooltip}
        ${checkboxHtml}
      </div>
    `}).join('')}
  </div>${isCollection ? '<p class="collection-note">Navigate to the next page in-game to import more items</p>' : ''}`
}

/**
 * Attach selection handlers to selectable items
 */
function attachSelectionHandlers(container) {
  container.querySelectorAll('.selectable').forEach(item => {
    item.addEventListener('click', () => {
      const originalIndex = parseInt(item.dataset.index, 10)
      const checkbox = item.querySelector('.item-checkbox')
      if (checkbox) {
        toggleItemSelection(originalIndex, checkbox)
      }
    })
  })

  // Uncheck items when their image fails to load
  container.querySelectorAll('.selectable img').forEach(img => {
    img.addEventListener('error', () => {
      const item = img.closest('.selectable')
      if (!item) return
      const originalIndex = parseInt(item.dataset.index, 10)
      const checkbox = item.querySelector('.item-checkbox')
      if (checkbox && selectedItems.has(originalIndex)) {
        selectedItems.delete(originalIndex)
        checkbox.classList.remove('checked')
        updateSelectionCount()
      }
    })
  })
}

/**
 * Render party detail with sections for job, characters, weapons, summons, accessories
 */
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
        <div class="item-grid weapons party-weapons">
          ${weapons.map(item => {
            const id = item.master?.id || item.param?.id || item.id
            const imageUrl = getImageUrl(`weapon-grid/${id}.jpg`)
            const modifiers = renderWeaponModifiers(item)
            const hasTooltip = modifiers.tooltip ? ' has-tooltip' : ''
            const keyNames = modifiers.keys.map(k => k.name).join(' · ')
            return `
              <div class="party-weapon-wrapper">
                <div class="grid-item${hasTooltip}">
                  ${modifiers.html}
                  <img src="${imageUrl}" alt="" draggable="false">
                  ${modifiers.tooltip}
                </div>
                ${keyNames ? `<div class="weapon-keys-label">${keyNames}</div>` : ''}
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

/**
 * Count items in data
 */
export function countItems(dataType, data) {
  const items = extractItems(dataType, data)
  return items.length
}
