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
  container.innerHTML = `<div class="item-grid ${gridClass} square-cells">
    ${items.map((item, filteredIndex) => {
      const originalIndex = isCollection ? itemIndexMap[filteredIndex] : filteredIndex
      const isChecked = isCollection && selectedItems.has(originalIndex)
      const checkboxHtml = isCollection ? `
        <label class="item-checkbox${isChecked ? ' checked' : ''}" data-index="${originalIndex}">
          <span class="checkbox-indicator">${CHECK_ICON}</span>
        </label>
      ` : ''
      return `
      <div class="grid-item${isCollection ? ' selectable' : ''}" data-index="${originalIndex}">
        <img src="${getItemImageUrl(dataType, item)}" alt="">
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

/**
 * Count items in data
 */
export function countItems(dataType, data) {
  const items = extractItems(dataType, data)
  return items.length
}
