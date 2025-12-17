/**
 * @fileoverview Popup script for the Granblue Fantasy Chrome extension.
 * Handles tab navigation, authentication, and data operations.
 */

import { performLogin, fetchUserInfo } from "./auth.js"
import { formatCacheStatus } from "./cache.js"
import {
  getDataTypeName,
  TAB_DATA_TYPES,
  getImageUrl,
  getSiteBaseUrl
} from "./constants.js"
import {
  show,
  hide,
  setElementColor,
  clearElementColors
} from "./dom.js"

// ==========================================
// STATE
// ==========================================

let activeTab = 'party'
let selectedDataTypes = {
  party: null,
  collection: null,
  database: null
}
let cachedStatus = null

// Detail view navigation state
let detailViewActive = false
let currentDetailDataType = null
let selectedItems = new Set() // Track selected item indices for collection views
let currentItemIndexMap = [] // Maps filtered index to original index for collections

// Rarity filter state: which rarities to show
// GBF rarity values: 4=SSR, 3=SR, 2=R, 1=N
let activeRarityFilters = new Set(['4']) // SSR shown by default

// Exclude Lv1 filter state (for weapons/summons only)
let excludeLv1Items = true // Enabled by default

const RARITY_LABELS = {
  '4': 'SSR',
  '3': 'SR',
  '2': 'R'
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // Set CSS variables for images
  document.documentElement.style.setProperty(
    '--login-bg-image',
    `url('${getImageUrl('port-breeze.jpg')}')`
  )

  initializeApp()
})

/**
 * Initialize the app based on auth state
 */
async function initializeApp() {
  const { gbAuth, noticeAcknowledged } = await chrome.storage.local.get([
    'gbAuth',
    'noticeAcknowledged'
  ])

  const loginView = document.getElementById('loginView')
  const mainView = document.getElementById('mainView')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  if (gbAuth?.access_token) {
    // User is logged in - show main view
    hide(loginView)
    show(mainView)

    updateProfileUI(gbAuth)
    updateTabVisibility(gbAuth.role)
    initializeEventListeners()
    refreshAllCaches()
  } else {
    // User not logged in - show login view
    show(loginView)
    hide(mainView)

    // Handle warning acknowledgment
    if (noticeAcknowledged) {
      hide(warning)
      show(loginFormContainer)
    } else {
      show(warning)
      hide(loginFormContainer)
    }

    initializeLoginListeners()
  }

  // Set up message listener for data capture events
  chrome.runtime.onMessage.addListener(handleMessages)
}

// ==========================================
// EVENT LISTENERS
// ==========================================

/**
 * Set up login view event listeners
 */
function initializeLoginListeners() {
  const acknowledgeButton = document.getElementById('acknowledgeButton')
  const loginButton = document.getElementById('loginButton')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  acknowledgeButton?.addEventListener('click', () => {
    chrome.storage.local.set({ noticeAcknowledged: true })
    hide(warning)
    show(loginFormContainer)
  })

  loginButton?.addEventListener('click', handleLogin)

  // Handle enter key in login form
  document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin()
  })
}

/**
 * Set up main view event listeners
 */
function initializeEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab)
    })
  })

  // Profile actions
  document.getElementById('logoutButton')?.addEventListener('click', handleLogout)
  document.getElementById('clearCacheButton')?.addEventListener('click', handleClearCache)
  document.getElementById('showWarning')?.addEventListener('click', handleShowWarning)

  // Detail view buttons
  document.getElementById('detailBack')?.addEventListener('click', hideDetailView)
  document.getElementById('detailCopy')?.addEventListener('click', handleDetailCopy)
  document.getElementById('detailImport')?.addEventListener('click', handleDetailImport)

  // Rarity filter
  initializeFilterListeners()

  // Selection bar buttons
  document.getElementById('selectAllBtn')?.addEventListener('click', handleSelectAll)
  document.getElementById('unselectAllBtn')?.addEventListener('click', handleUnselectAll)
}

// ==========================================
// TAB NAVIGATION
// ==========================================

/**
 * Switch to a different tab
 */
function switchTab(tabName) {
  activeTab = tabName

  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName)
  })

  // Update panels
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('active', p.id === `${tabName}Panel`)
  })

  // Refresh cache display for this tab
  if (cachedStatus) {
    updateTabCacheDisplay(tabName, cachedStatus)
  }
}

/**
 * Show/hide Database tab based on user role
 */
function updateTabVisibility(userRole) {
  const databaseTab = document.getElementById('databaseTab')
  if (userRole >= 7) {
    databaseTab?.classList.remove('hidden')
  } else {
    databaseTab?.classList.add('hidden')
  }
}

// ==========================================
// DETAIL VIEW NAVIGATION
// ==========================================

/**
 * Show detail view for a data type
 */
async function showDetailView(dataType) {
  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType
  })

  if (response.error) {
    showTabStatus(activeTab, response.error, 'error')
    return
  }

  currentDetailDataType = dataType

  // Update metadata
  const status = cachedStatus[dataType]
  document.getElementById('detailFreshness').textContent = status.ageText

  if (dataType.startsWith('party_')) {
    // Party shows section counts
    // Characters are at deck.npc, weapons/summons are at deck.pc
    const deck = response.data.deck || {}
    const pc = deck.pc || {}
    const chars = toArray(deck.npc).filter(Boolean).length
    const wpns = toArray(pc.weapons).filter(Boolean).length
    const sums = toArray(pc.summons).filter(Boolean).length
    document.getElementById('detailPageCount').textContent = ''
    document.getElementById('detailItemCount').textContent = `${chars} characters · ${wpns} weapons · ${sums} summons`
  } else if (isDatabaseDetailType(dataType)) {
    // Database detail shows item name
    const name = response.data.name || response.data.master?.name || ''
    document.getElementById('detailPageCount').textContent = ''
    document.getElementById('detailItemCount').textContent = name
  } else {
    document.getElementById('detailPageCount').textContent = status.pageCount ? `${status.pageCount} pages` : ''
    document.getElementById('detailItemCount').textContent = `${status.totalItems || countItems(dataType, response.data)} items`
  }

  // Reset import button
  const importBtn = document.getElementById('detailImport')
  importBtn.textContent = 'Import'
  importBtn.disabled = false
  importBtn.classList.remove('imported')

  // Show/hide rarity filter and selection bar based on data type
  const filterEl = document.getElementById('detailFilter')
  const selectionBar = document.getElementById('detailSelectionBar')
  if (isCollectionType(dataType)) {
    filterEl?.classList.remove('hidden')
    selectionBar?.classList.remove('hidden')
    resetRarityFilter() // Reset to default SSR-only
    resetLv1Filter(dataType) // Reset and show/hide Lv1 filter based on data type
    selectedItems = new Set() // Clear selections for fresh render
  } else {
    filterEl?.classList.add('hidden')
    selectionBar?.classList.add('hidden')
  }

  // Render items
  renderDetailItems(dataType, response.data)

  // Slide in
  document.getElementById('detailView').classList.add('active')
  detailViewActive = true
}

/**
 * Hide detail view
 */
function hideDetailView() {
  document.getElementById('detailView').classList.remove('active')
  detailViewActive = false
  currentDetailDataType = null

  // Close filter dropdown if open
  document.getElementById('filterDropdown')?.classList.remove('open')
}

/**
 * Count items in data
 */
function countItems(dataType, data) {
  const items = extractItems(dataType, data)
  return items.length
}

// Checkmark SVG for checkboxes
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7139 4.04764C13.14 3.52854 13.0837 2.74594 12.5881 2.29964C12.0925 1.85335 11.3453 1.91237 10.9192 2.43147L5.28565 9.94404L3.02018 7.32366C2.55804 6.83959 1.80875 6.83959 1.34661 7.32366C0.884464 7.80772 0.884464 8.59255 1.34661 9.07662L4.50946 12.6369C4.9716 13.121 5.72089 13.121 6.18303 12.6369C6.2359 12.5816 6.28675 12.5271 6.33575 12.4674L12.7139 4.04764Z"/></svg>`

/**
 * Check if a data type is a collection type (supports item selection)
 */
function isCollectionType(dataType) {
  return dataType.startsWith('collection_') || dataType.startsWith('list_')
}

/**
 * Check if a data type is a weapon or summon collection (supports Lv1 filter)
 */
function isWeaponOrSummonCollection(dataType) {
  return dataType.includes('weapon') || dataType.includes('summon')
}

/**
 * Check if a data type is a database detail type
 */
function isDatabaseDetailType(dataType) {
  return dataType.startsWith('detail_')
}

/**
 * Render items in detail view
 */
function renderDetailItems(dataType, data) {
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
  currentItemIndexMap = [] // Reset mapping

  if (isCollection) {
    items = []
    allItems.forEach((item, originalIndex) => {
      // Rarity can be at item.master.rarity (weapons/summons) or item.param.rarity (characters)
      const rarity = item.rarity || item.master?.rarity || item.param?.rarity
      // Show item if no rarity (unknown) or rarity matches active filters
      if (!rarity || activeRarityFilters.has(String(rarity))) {
        currentItemIndexMap.push(originalIndex)
        items.push(item)
      }
    })

    // Initialize selection: only SSR items (rarity "4") checked by default
    // Also exclude Lv1 items for weapons/summons if filter is enabled
    // Preserve existing selections if re-rendering due to filter change
    const isFirstRender = selectedItems.size === 0 || !detailViewActive
    if (isFirstRender) {
      selectedItems = new Set()
      const shouldExcludeLv1 = excludeLv1Items && isWeaponOrSummonCollection(dataType)
      items.forEach((item, filteredIndex) => {
        // Rarity can be at item.master.rarity (weapons/summons) or item.param.rarity (characters)
        const rarity = item.rarity || item.master?.rarity || item.param?.rarity
        // Only pre-select if it's an SSR (rarity 4, can be string or number)
        // Also skip Lv1 items if excludeLv1 filter is enabled for weapons/summons
        if (String(rarity) === '4') {
          if (shouldExcludeLv1 && Number(item.param.level) === 1) {
            // Don't pre-select Lv1 items
          } else {
            selectedItems.add(currentItemIndexMap[filteredIndex])
          }
        }
      })
    }
  }

  const hasNames = items.some(item => item.name || item.master?.name)

  if (hasNames) {
    // List layout with names
    container.innerHTML = `<div class="item-list">
      ${items.map((item, filteredIndex) => {
        const originalIndex = isCollection ? currentItemIndexMap[filteredIndex] : filteredIndex
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
  } else {
    // Grid layout (collection views use square-cells for fixed width)
    const gridClass = getGridClass(dataType)
    container.innerHTML = `<div class="item-grid ${gridClass} square-cells">
      ${items.map((item, filteredIndex) => {
        const originalIndex = isCollection ? currentItemIndexMap[filteredIndex] : filteredIndex
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

  // Add click handlers for selectable items (whole item toggles checkbox)
  if (isCollection) {
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

  // Update selection count display
  if (isCollection) {
    updateSelectionCount()
  }
}

/**
 * Toggle item selection
 */
function toggleItemSelection(index, checkbox) {
  if (selectedItems.has(index)) {
    selectedItems.delete(index)
    checkbox.classList.remove('checked')
  } else {
    selectedItems.add(index)
    checkbox.classList.add('checked')
  }
  updateSelectionCount()
}

/**
 * Update the selection count in the header
 */
function updateSelectionCount() {
  const countEl = document.getElementById('detailItemCount')
  if (countEl && isCollectionType(currentDetailDataType)) {
    const total = document.querySelectorAll('#detailItems .item-checkbox').length
    // Count only visible selected items (using currentItemIndexMap)
    const visibleSelectedCount = currentItemIndexMap.filter(idx => selectedItems.has(idx)).length
    countEl.textContent = `${visibleSelectedCount}/${total} selected`
  }
}

/**
 * Handle Select All button click
 */
function handleSelectAll() {
  // Select all visible items (those in currentItemIndexMap)
  currentItemIndexMap.forEach(originalIndex => {
    selectedItems.add(originalIndex)
  })
  // Update checkbox UI
  document.querySelectorAll('#detailItems .item-checkbox').forEach(checkbox => {
    checkbox.classList.add('checked')
  })
  updateSelectionCount()
}

/**
 * Handle Unselect All button click
 */
function handleUnselectAll() {
  // Unselect all visible items (those in currentItemIndexMap)
  currentItemIndexMap.forEach(originalIndex => {
    selectedItems.delete(originalIndex)
  })
  // Update checkbox UI
  document.querySelectorAll('#detailItems .item-checkbox').forEach(checkbox => {
    checkbox.classList.remove('checked')
  })
  updateSelectionCount()
}

// ==========================================
// RARITY FILTER
// ==========================================

/**
 * Initialize filter dropdown event listeners
 */
function initializeFilterListeners() {
  const filterButton = document.getElementById('filterButton')
  const filterDropdown = document.getElementById('filterDropdown')

  filterButton?.addEventListener('click', (e) => {
    e.stopPropagation()
    filterDropdown.classList.toggle('open')
  })

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.detail-filter')) {
      filterDropdown?.classList.remove('open')
    }
  })

  // Handle rarity checkbox changes (checkboxes with value attribute)
  filterDropdown?.querySelectorAll('input[type="checkbox"][value]:not(:disabled)').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateRarityFilter()
    })
  })

  // Handle Lv1 filter checkbox change
  const lv1Checkbox = document.getElementById('excludeLv1Checkbox')
  lv1Checkbox?.addEventListener('change', () => {
    updateLv1Filter()
  })
}

/**
 * Update rarity filter based on checkbox states
 */
async function updateRarityFilter() {
  const checkboxes = document.querySelectorAll('#filterDropdown input[type="checkbox"]')
  activeRarityFilters = new Set()

  checkboxes.forEach(cb => {
    if (cb.checked) {
      activeRarityFilters.add(cb.value)
    }
  })

  // Update button label
  updateFilterButtonLabel()

  // Re-render items (preserve selections)
  if (currentDetailDataType) {
    await refreshDetailView()
  }
}

/**
 * Update the filter button label based on active filters
 */
function updateFilterButtonLabel() {
  const button = document.getElementById('filterButton')
  if (!button) return

  const labels = []
  if (activeRarityFilters.has('4')) labels.push('SSR')
  if (activeRarityFilters.has('3')) labels.push('SR')
  if (activeRarityFilters.has('2')) labels.push('R')

  button.querySelector('span').textContent = labels.join(', ') || 'SSR'
}

/**
 * Reset rarity filter to default (SSR only)
 */
function resetRarityFilter() {
  activeRarityFilters = new Set(['4']) // SSR only
  // Reset checkboxes
  const dropdown = document.getElementById('filterDropdown')
  dropdown?.querySelectorAll('input[type="checkbox"][value]').forEach(cb => {
    cb.checked = cb.value === '4' // Only SSR checked by default
  })
  updateFilterButtonLabel()
}

/**
 * Reset Lv1 filter and show/hide based on data type
 */
function resetLv1Filter(dataType) {
  const lv1FilterOption = document.getElementById('lv1FilterOption')
  const lv1FilterDivider = document.getElementById('lv1FilterDivider')
  const lv1Checkbox = document.getElementById('excludeLv1Checkbox')

  if (isCollectionType(dataType) && isWeaponOrSummonCollection(dataType)) {
    // Show Lv1 filter for weapons and summons
    lv1FilterOption?.classList.remove('hidden')
    lv1FilterDivider?.classList.remove('hidden')
    excludeLv1Items = true // Default to enabled
    if (lv1Checkbox) lv1Checkbox.checked = true
  } else {
    // Hide Lv1 filter for characters and other types
    lv1FilterOption?.classList.add('hidden')
    lv1FilterDivider?.classList.add('hidden')
    excludeLv1Items = false
  }
}

/**
 * Update Lv1 filter based on checkbox state and re-apply selections
 */
async function updateLv1Filter() {
  const lv1Checkbox = document.getElementById('excludeLv1Checkbox')
  excludeLv1Items = lv1Checkbox?.checked ?? false

  // Clear selections and re-render to re-apply selection logic
  if (currentDetailDataType) {
    selectedItems = new Set() // Clear to trigger fresh selection
    await refreshDetailView()
  }
}

/**
 * Refresh detail view with current data (re-render after filter change)
 */
async function refreshDetailView() {
  if (!currentDetailDataType) return

  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType: currentDetailDataType
  })

  if (!response.error) {
    renderDetailItems(currentDetailDataType, response.data)
  }
}

/**
 * Refresh detail view when new data is captured (preserves selections, adds new items)
 */
async function refreshDetailViewWithNewData() {
  if (!currentDetailDataType) return

  const dataType = currentDetailDataType

  // Remember how many items we had before
  const previousItemCount = currentItemIndexMap.length

  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType
  })

  if (response.error) return

  const data = response.data

  // Update metadata from refreshed cache
  await refreshAllCaches()
  const status = cachedStatus[dataType]
  if (status) {
    document.getElementById('detailFreshness').textContent = status.ageText
    document.getElementById('detailPageCount').textContent = status.pageCount ? `${status.pageCount} pages` : ''
  }

  // Extract all items and filter by current rarity settings
  const allItems = extractItems(dataType, data)
  const shouldExcludeLv1 = excludeLv1Items && isWeaponOrSummonCollection(dataType)

  // Pre-select new items (those beyond previous count) before rendering
  let newSelectedCount = 0
  allItems.forEach((item, index) => {
    // Only process items beyond what we had before
    if (index >= previousItemCount) {
      const rarity = item.rarity || item.master?.rarity || item.param?.rarity
      // Check if item passes current rarity filter
      if (String(rarity) === '4' || activeRarityFilters.has(String(rarity))) {
        // Auto-select SSR items (unless Lv1 exclusion applies)
        if (String(rarity) === '4') {
          if (shouldExcludeLv1 && Number(item.param?.level) === 1) {
            // Don't pre-select Lv1 items
          } else {
            selectedItems.add(index)
            newSelectedCount++
          }
        }
      }
    }
  })

  // Re-render with updated data (preserves existing selections)
  renderDetailItems(dataType, data)

  // Show toast if new items were added
  if (newSelectedCount > 0) {
    showToast(`${newSelectedCount} new items added`)
  }
}

/**
 * Convert object or array to array (handles GBF's inconsistent data formats)
 */
function toArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  return Object.values(data)
}

/**
 * Render party detail with sections for job, characters, weapons, summons, accessories
 */
function renderPartyDetail(container, data) {
  // Characters are at deck.npc, weapons/summons are at deck.pc
  const deck = data.deck || {}
  const pc = deck.pc || {}
  const job = pc.job
  const characters = toArray(deck.npc).filter(Boolean)
  const weapons = toArray(pc.weapons).filter(Boolean)
  const summons = toArray(pc.summons).filter(Boolean)

  // Accessories: familiar_id (manabelly/manatura) and shield_id
  const accessoryIds = [pc.familiar_id, pc.shield_id].filter(Boolean)

  let html = ''

  // Job section
  if (job?.master?.id) {
    const jobId = job.master.id
    const jobName = job.master.name || 'Job'
    // Use Gran (a) by default, could detect from data if available
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

  // Characters section
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

  // Weapons section
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

  // Summons section
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

  // Accessories section (manabelly, manatura, shields)
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

// Granblue Fantasy CDN for game assets
const GBF_CDN = 'https://prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/assets'

/**
 * Render database detail view (single character/weapon/summon)
 */
function renderDatabaseDetail(container, dataType, data) {
  const id = data.id || data.master?.id
  const name = data.name || data.master?.name || 'Unknown'
  const element = data.attribute || data.element || data.master?.attribute || data.master?.element

  let imageUrl = ''
  let fallbackUrl = ''
  let imageClass = ''

  // Use GBF's CDN since these are new items not yet on our S3
  // Use startsWith to handle per-item data types (detail_npc_123, etc.)
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

  // Add type-specific stats (includes name, element, proficiency as rows)
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

  // HP/ATK: check param (current stats), then master (base stats), then top-level
  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'

  // Name
  html += `<div class="stat-row"><span class="stat-label">Name</span><span class="stat-value">${name}</span></div>`

  // ID
  if (id) {
    html += `<div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${id}</span></div>`
  }

  // Series
  const seriesId = data.series_id || master.series_id
  if (seriesId && GAME_CHARACTER_SERIES_NAMES[seriesId]) {
    html += `<div class="stat-row"><span class="stat-label">Series</span><span class="stat-value">${GAME_CHARACTER_SERIES_NAMES[seriesId]}</span></div>`
  }

  // Element
  if (element && GAME_ELEMENT_NAMES[element]) {
    html += `<div class="stat-row"><span class="stat-label">Element</span><span class="stat-value"><img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="${GAME_ELEMENT_NAMES[element]}"></span></div>`
  }

  // Proficiency (characters can have up to 2)
  if (proficiencies.length > 0) {
    const profIcons = proficiencies
      .filter(p => GAME_PROFICIENCY_NAMES[p])
      .map(p => `<img class="stat-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[p]}.png`)}" alt="${GAME_PROFICIENCY_NAMES[p]}">`)
      .join('')
    if (profIcons) {
      html += `<div class="stat-row"><span class="stat-label">Proficiency</span><span class="stat-value">${profIcons}</span></div>`
    }
  }

  // Uncap stars (based on max level)
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Uncap</span><span class="stat-value">${renderCharacterStars(level)}</span></div>`
  }

  // Min HP
  if (minHp) {
    html += `<div class="stat-row"><span class="stat-label">Min HP</span><span class="stat-value">${Number(minHp).toLocaleString()}</span></div>`
  }

  // Max HP
  if (maxHp) {
    html += `<div class="stat-row"><span class="stat-label">Max HP</span><span class="stat-value">${Number(maxHp).toLocaleString()}</span></div>`
  }

  // Min ATK
  if (minAtk) {
    html += `<div class="stat-row"><span class="stat-label">Min ATK</span><span class="stat-value">${Number(minAtk).toLocaleString()}</span></div>`
  }

  // Max ATK
  if (maxAtk) {
    html += `<div class="stat-row"><span class="stat-label">Max ATK</span><span class="stat-value">${Number(maxAtk).toLocaleString()}</span></div>`
  }

  // Max Level
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Max Level</span><span class="stat-value">${level}</span></div>`
  }

  // Perpetuity Ring
  if (ringed) {
    html += `<div class="stat-row"><span class="stat-label">Perpetuity Ring</span><span class="stat-value">✓</span></div>`
  }

  // Comment/description
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

  // HP/ATK: check param (current stats), then master (base stats), then top-level
  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'

  // Name
  html += `<div class="stat-row"><span class="stat-label">Name</span><span class="stat-value">${name}</span></div>`

  // ID
  if (id) {
    html += `<div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${id}</span></div>`
  }

  // Series
  const seriesId = data.series_id || master.series_id
  if (seriesId && GAME_WEAPON_SERIES_NAMES[seriesId]) {
    html += `<div class="stat-row"><span class="stat-label">Series</span><span class="stat-value">${GAME_WEAPON_SERIES_NAMES[seriesId]}</span></div>`
  }

  // Element
  if (element && GAME_ELEMENT_NAMES[element]) {
    html += `<div class="stat-row"><span class="stat-label">Element</span><span class="stat-value"><img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="${GAME_ELEMENT_NAMES[element]}"></span></div>`
  }

  // Proficiency
  if (proficiency && GAME_PROFICIENCY_NAMES[proficiency]) {
    html += `<div class="stat-row"><span class="stat-label">Proficiency</span><span class="stat-value"><img class="stat-icon" src="${getImageUrl(`labels/proficiency/Label_Weapon_${GAME_PROFICIENCY_NAMES[proficiency]}.png`)}" alt="${GAME_PROFICIENCY_NAMES[proficiency]}"></span></div>`
  }

  // Uncap stars (based on max level)
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Uncap</span><span class="stat-value">${renderWeaponStars(level)}</span></div>`
  }

  // Min HP
  if (minHp) {
    html += `<div class="stat-row"><span class="stat-label">Min HP</span><span class="stat-value">${Number(minHp).toLocaleString()}</span></div>`
  }

  // Max HP
  if (maxHp) {
    html += `<div class="stat-row"><span class="stat-label">Max HP</span><span class="stat-value">${Number(maxHp).toLocaleString()}</span></div>`
  }

  // Min ATK
  if (minAtk) {
    html += `<div class="stat-row"><span class="stat-label">Min ATK</span><span class="stat-value">${Number(minAtk).toLocaleString()}</span></div>`
  }

  // Max ATK
  if (maxAtk) {
    html += `<div class="stat-row"><span class="stat-label">Max ATK</span><span class="stat-value">${Number(maxAtk).toLocaleString()}</span></div>`
  }

  // Max Level
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Max Level</span><span class="stat-value">${level}</span></div>`
  }

  // Awakening
  const arousal = param.arousal
  if (arousal?.is_arousal_weapon) {
    html += `<div class="stat-row"><span class="stat-label">Awakening</span><span class="stat-value">${arousal.form_name || 'Attack'} Lv.${arousal.level || 1}</span></div>`
  }

  // AX Skills
  const axSkills = param.augment_skill_info?.[0]
  if (axSkills && Object.keys(axSkills).length > 0) {
    const axCount = Object.keys(axSkills).length
    html += `<div class="stat-row"><span class="stat-label">AX Skills</span><span class="stat-value">${axCount} skill${axCount > 1 ? 's' : ''}</span></div>`
  }

  // Comment/description
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

  // HP/ATK: check param (current stats), then master (base stats), then top-level
  const minHp = master.default_hp || data.default_hp
  const maxHp = param.hp || master.max_hp || data.max_hp
  const minAtk = master.default_attack || data.default_attack
  const maxAtk = param.attack || master.max_attack || data.max_attack
  const level = param.level || master.max_level

  let html = '<div class="database-stats">'

  // Name
  html += `<div class="stat-row"><span class="stat-label">Name</span><span class="stat-value">${name}</span></div>`

  // ID
  if (id) {
    html += `<div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${id}</span></div>`
  }

  // Series
  const seriesId = data.series_id || master.series_id
  if (seriesId && GAME_SUMMON_SERIES_NAMES[seriesId]) {
    html += `<div class="stat-row"><span class="stat-label">Series</span><span class="stat-value">${GAME_SUMMON_SERIES_NAMES[seriesId]}</span></div>`
  }

  // Element
  if (element && GAME_ELEMENT_NAMES[element]) {
    html += `<div class="stat-row"><span class="stat-label">Element</span><span class="stat-value"><img class="stat-icon" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[element]}.png`)}" alt="${GAME_ELEMENT_NAMES[element]}"></span></div>`
  }

  // Uncap stars (based on max level)
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Uncap</span><span class="stat-value">${renderSummonStars(level)}</span></div>`
  }

  // Min HP
  if (minHp) {
    html += `<div class="stat-row"><span class="stat-label">Min HP</span><span class="stat-value">${Number(minHp).toLocaleString()}</span></div>`
  }

  // Max HP
  if (maxHp) {
    html += `<div class="stat-row"><span class="stat-label">Max HP</span><span class="stat-value">${Number(maxHp).toLocaleString()}</span></div>`
  }

  // Min ATK
  if (minAtk) {
    html += `<div class="stat-row"><span class="stat-label">Min ATK</span><span class="stat-value">${Number(minAtk).toLocaleString()}</span></div>`
  }

  // Max ATK
  if (maxAtk) {
    html += `<div class="stat-row"><span class="stat-label">Max ATK</span><span class="stat-value">${Number(maxAtk).toLocaleString()}</span></div>`
  }

  // Max Level
  if (level) {
    html += `<div class="stat-row"><span class="stat-label">Max Level</span><span class="stat-value">${level}</span></div>`
  }

  // Sub Aura
  const subAura = data.sub_skill?.name
  if (subAura) {
    html += `<div class="stat-row"><span class="stat-label">Sub Aura</span><span class="stat-value">${subAura}</span></div>`
  }

  // Comment/description
  const comment = data.comment || master.comment
  if (comment) {
    html += `<div class="stat-row stat-comment"><span class="stat-value">${comment}</span></div>`
  }

  html += '</div>'
  return html
}

/**
 * Render uncap stars for characters based on max level
 * - Max level 80: 4 yellow stars
 * - Max level 100: 4 yellow + 1 blue star
 * - Max level 150: 4 yellow + 1 blue + 1 purple star
 * @param {number} maxLevel - The character's max level
 * @returns {string} HTML string for stars
 */
function renderCharacterStars(maxLevel) {
  let html = '<span class="stars">'

  // 4 yellow stars for base (max level 80)
  for (let i = 0; i < 4; i++) {
    html += '<span class="star filled"></span>'
  }

  // 1 blue star for FLB (max level 100)
  if (maxLevel >= 100) {
    html += '<span class="star flb"></span>'
  }

  // 1 purple star for ULB (max level 150)
  if (maxLevel >= 150) {
    html += '<span class="star ulb"></span>'
  }

  html += '</span>'
  return html
}

/**
 * Render uncap stars for weapons based on max level
 * - Max level 100: 3 yellow stars
 * - Max level 150: 3 yellow + 1 blue star
 * - Max level 200: 3 yellow + 2 blue stars
 * - Max level 250: 3 yellow + 2 blue + 1 purple star
 * @param {number} maxLevel - The weapon's max level
 * @returns {string} HTML string for stars
 */
function renderWeaponStars(maxLevel) {
  let html = '<span class="stars">'

  // 3 yellow stars for base (max level 100)
  for (let i = 0; i < 3; i++) {
    html += '<span class="star filled"></span>'
  }

  // 1 blue star for FLB (max level 150)
  if (maxLevel >= 150) {
    html += '<span class="star flb"></span>'
  }

  // 2nd blue star for ULB (max level 200)
  if (maxLevel >= 200) {
    html += '<span class="star flb"></span>'
  }

  // 1 purple star for transcendence (max level 250)
  if (maxLevel >= 250) {
    html += '<span class="star ulb"></span>'
  }

  html += '</span>'
  return html
}

/**
 * Render uncap stars for summons based on max level
 * - Max level 100: 3 yellow stars
 * - Max level 150: 3 yellow + 1 blue star
 * - Max level 200: 3 yellow + 2 blue stars
 * - Max level 250: 3 yellow + 2 blue + 1 purple star
 * @param {number} maxLevel - The summon's max level
 * @returns {string} HTML string for stars
 */
function renderSummonStars(maxLevel) {
  let html = '<span class="stars">'

  // 3 yellow stars for base (max level 100)
  for (let i = 0; i < 3; i++) {
    html += '<span class="star filled"></span>'
  }

  // 1 blue star for FLB (max level 150)
  if (maxLevel >= 150) {
    html += '<span class="star flb"></span>'
  }

  // 2nd blue star for ULB (max level 200)
  if (maxLevel >= 200) {
    html += '<span class="star flb"></span>'
  }

  // 1 purple star for transcendence (max level 250)
  if (maxLevel >= 250) {
    html += '<span class="star ulb"></span>'
  }

  html += '</span>'
  return html
}

/**
 * Extract items from data based on type
 */
function extractItems(dataType, data) {
  if (dataType.startsWith('collection_') || dataType.startsWith('list_')) {
    // Paginated collection - data.pages is an object keyed by page number
    const pages = Object.values(data)
    return pages.flatMap(page => page.list || [])
  }
  if (dataType.startsWith('party_')) {
    // Characters are at deck.npc, weapons/summons are at deck.pc
    const deck = data.deck || {}
    const pc = deck.pc || {}
    return [
      ...toArray(deck.npc),
      ...toArray(pc.weapons),
      ...toArray(pc.summons)
    ].filter(Boolean)
  }
  // Single detail item
  return [data]
}

/**
 * Get image URL for an item using siero-img S3 CDN
 */
function getItemImageUrl(dataType, item) {
  const granblueId = item.master?.id || item.param?.id || item.id

  // Use square images for detail view
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

// Hensei element ID to name mapping
const ELEMENT_NAMES = {
  1: 'Wind',
  2: 'Fire',
  3: 'Water',
  4: 'Earth',
  5: 'Dark',
  6: 'Light'
}

// Hensei proficiency ID to name mapping
const PROFICIENCY_NAMES = {
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

// Game element ID to name mapping (raw GBF data)
const GAME_ELEMENT_NAMES = {
  1: 'Fire',
  2: 'Water',
  3: 'Earth',
  4: 'Wind',
  5: 'Light',
  6: 'Dark'
}

// Game proficiency ID to name mapping (raw GBF data)
const GAME_PROFICIENCY_NAMES = {
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
 * Get element and proficiency labels for an artifact
 */
function getArtifactLabels(item) {
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
 * Get grid class based on data type
 */
function getGridClass(dataType) {
  if (dataType.includes('artifact')) return 'artifacts'
  if (dataType.includes('npc') || dataType.includes('character')) return 'characters'
  if (dataType.includes('weapon')) return 'weapons'
  if (dataType.includes('summon')) return 'summons'
  return ''
}

/**
 * Filter collection data to only include selected items
 */
function filterSelectedItems(dataType, data) {
  if (!isCollectionType(dataType)) return data

  const items = extractItems(dataType, data)
  const filteredItems = items.filter((_, i) => selectedItems.has(i))

  // Reconstruct the data structure with filtered items
  // Collection data is an object keyed by page number, each with a 'list' array
  const result = {}
  let itemIndex = 0

  for (const [pageNum, pageData] of Object.entries(data)) {
    const pageItems = pageData.list || []
    const filteredPageItems = []

    for (const item of pageItems) {
      if (selectedItems.has(itemIndex)) {
        filteredPageItems.push(item)
      }
      itemIndex++
    }

    if (filteredPageItems.length > 0) {
      result[pageNum] = { ...pageData, list: filteredPageItems }
    }
  }

  return result
}

/**
 * Handle copy from detail view
 */
async function handleDetailCopy() {
  if (!currentDetailDataType) return

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast('Failed to copy')
      return
    }

    // Filter to selected items for collections
    const dataToExport = filterSelectedItems(currentDetailDataType, response.data)

    const jsonString = JSON.stringify(dataToExport, null, 2)
    await navigator.clipboard.writeText(jsonString)

    if (isCollectionType(currentDetailDataType)) {
      showToast(`Copied ${selectedItems.size} items`)
    } else {
      showToast('Copied to clipboard')
    }
  } catch (error) {
    showToast('Failed to copy')
  }
}

/**
 * Handle import from detail view
 */
async function handleDetailImport() {
  if (!currentDetailDataType) return

  const importBtn = document.getElementById('detailImport')
  if (importBtn) {
    importBtn.disabled = true
    importBtn.textContent = 'Importing...'
  }

  try {
    // Get cached data
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast('Import failed')
      return
    }

    // Filter to selected items for collections
    const dataToUpload = filterSelectedItems(currentDetailDataType, response.data)

    // Upload based on data type
    let uploadResponse
    if (currentDetailDataType.startsWith('party_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadPartyData',
        data: dataToUpload
      })
    } else if (currentDetailDataType.startsWith('detail_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadDetailData',
        data: dataToUpload,
        dataType: currentDetailDataType
      })
    } else if (currentDetailDataType.startsWith('collection_') || currentDetailDataType.startsWith('list_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadCollectionData',
        data: dataToUpload,
        dataType: currentDetailDataType,
        updateExisting: false
      })
    } else {
      showToast('Import not supported')
      return
    }

    if (uploadResponse.error) {
      showToast(uploadResponse.error)
    } else if (uploadResponse.url) {
      // Party import - opens in new tab
      chrome.tabs.create({ url: uploadResponse.url })
      showToast('Opening party...')
    } else if (uploadResponse.created !== undefined) {
      // Collection import
      const total = uploadResponse.created + uploadResponse.updated
      showToast(`Imported ${total} items`)
      if (importBtn) {
        importBtn.textContent = 'Imported'
        importBtn.classList.add('imported')
      }
    } else {
      showToast('Import successful')
      if (importBtn) {
        importBtn.textContent = 'Imported'
        importBtn.classList.add('imported')
      }
    }
  } catch (error) {
    showToast('Import failed')
  } finally {
    if (importBtn && !importBtn.classList.contains('imported')) {
      importBtn.disabled = false
      importBtn.textContent = 'Import'
    }
  }
}

// ==========================================
// AUTHENTICATION
// ==========================================

/**
 * Handle login button click
 */
async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim()
  const password = document.getElementById('loginPassword').value.trim()
  const loginButton = document.getElementById('loginButton')
  const loginStatus = document.getElementById('loginStatus')

  if (!username || !password) {
    showStatus(loginStatus, 'Please enter username and password', 'error')
    return
  }

  loginButton.disabled = true
  showStatus(loginStatus, 'Logging in...', 'info')

  try {
    // Perform login
    let gbAuth = await performLogin(username, password)

    // Fetch additional user info (including role for permissions)
    const userInfo = await fetchUserInfo(gbAuth.access_token)
    gbAuth = {
      ...gbAuth,
      avatar: userInfo.avatar,
      language: userInfo.language,
      role: userInfo.role || 0
    }

    // Only save auth after both steps succeed
    await chrome.storage.local.set({ gbAuth })

    showStatus(loginStatus, 'Login successful!', 'success')

    // Switch to main view after brief delay
    setTimeout(() => {
      initializeApp()
    }, 1000)

  } catch (err) {
    console.error('Login error:', err)
    showStatus(loginStatus, err.message || 'Login failed', 'error')
    loginButton.disabled = false
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  await chrome.storage.local.remove(['gbAuth'])
  clearElementColors(document.body)
  initializeApp()
}

/**
 * Handle show warning/disclaimer
 */
function handleShowWarning() {
  const loginView = document.getElementById('loginView')
  const mainView = document.getElementById('mainView')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  // Show warning in login view, hide main view
  show(loginView)
  hide(mainView)
  show(warning)
  hide(loginFormContainer)

  // Update acknowledge button to return to main view instead of showing login
  const acknowledgeButton = document.getElementById('acknowledgeButton')
  acknowledgeButton.onclick = () => {
    hide(loginView)
    show(mainView)
    // Reset the button for normal login flow
    acknowledgeButton.onclick = null
    initializeLoginListeners()
  }
}

// ==========================================
// PROFILE UI
// ==========================================

/**
 * Update profile UI with user data
 */
async function updateProfileUI(gbAuth) {
  const tabAvatar = document.getElementById('tabAvatar')
  const profileAvatar = document.getElementById('profileAvatar')
  const profileUsername = document.getElementById('profileUsername')
  const profileHeader = document.getElementById('viewProfile')

  // Update username
  if (profileUsername) {
    profileUsername.textContent = gbAuth.user?.username || 'User'
  }

  // Update avatars
  const avatarUrl = gbAuth.avatar?.picture
    ? getImageUrl(`profile/${gbAuth.avatar.picture}@2x.png`)
    : getImageUrl('profile/npc@2x.png')

  if (tabAvatar) tabAvatar.src = avatarUrl
  if (profileAvatar) profileAvatar.src = avatarUrl

  // Set element color on body
  if (gbAuth.avatar?.element) {
    setElementColor(document.body, gbAuth.avatar.element)
  }

  // Update profile link
  if (profileHeader && gbAuth.user?.username) {
    const siteUrl = await getSiteBaseUrl()
    profileHeader.href = `${siteUrl}/${gbAuth.user.username}`
  }
}

// ==========================================
// CACHE MANAGEMENT
// ==========================================

/**
 * Refresh cache status for all tabs
 */
async function refreshAllCaches() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCacheStatus' })

    if (response?.error) {
      console.error('Cache status error:', response.error)
      cachedStatus = {}
    } else {
      cachedStatus = formatCacheStatus(response || {})
    }
  } catch (error) {
    console.error('Error refreshing cache:', error)
    cachedStatus = {}
  }

  // Always update all data tabs
  updateTabCacheDisplay('party', cachedStatus)
  updateTabCacheDisplay('collection', cachedStatus)
  updateTabCacheDisplay('database', cachedStatus)
}

/**
 * Update cache display for a specific tab
 */
function updateTabCacheDisplay(tabName, status) {
  const container = document.getElementById(`${tabName}Items`)
  if (!container) return

  // Get types to display - party and database tabs discover dynamically from status
  let typesToDisplay = []
  if (tabName === 'party') {
    // Find all party_* types in status
    typesToDisplay = Object.keys(status || {})
      .filter(type => type.startsWith('party_') && status[type]?.available)
  } else if (tabName === 'database') {
    // Find all detail_*_* types in status (per-item, like parties)
    typesToDisplay = Object.keys(status || {})
      .filter(type =>
        (type.startsWith('detail_npc_') ||
         type.startsWith('detail_weapon_') ||
         type.startsWith('detail_summon_')) &&
        status[type]?.available
      )
  } else {
    typesToDisplay = (TAB_DATA_TYPES[tabName] || [])
      .filter(type => status?.[type]?.available)
  }

  // Sort by lastUpdated descending (most recent first)
  typesToDisplay.sort((a, b) => {
    const aTime = status[a]?.lastUpdated || 0
    const bTime = status[b]?.lastUpdated || 0
    return bTime - aTime
  })

  if (typesToDisplay.length === 0) {
    container.innerHTML = `<p class="cache-empty">${getEmptyMessage(tabName)}</p>`
    return
  }

  let html = ''

  for (const type of typesToDisplay) {
    const info = status[type]
    if (!info?.available) continue

    // Use partyName for parties, displayName for others
    const displayName = info.partyName || info.displayName

    const subtitleHtml = info.subtitle
      ? `<span class="cache-subtitle">${info.subtitle}</span>`
      : ''

    html += `
      <div class="cache-item ${info.statusClass}" data-type="${type}" data-tab="${tabName}">
        <div class="cache-info">
          <span class="cache-name">${displayName}</span>
          ${subtitleHtml}
        </div>
        <div class="cache-right">
          <span class="cache-age">${info.ageText}</span>
          <button class="cache-detail-btn" data-type="${type}" aria-label="View details">
            <svg class="icon-chevron" viewBox="0 0 14 14" fill="currentColor">
              <path d="M4.17094 2.04309C4.56138 1.6528 5.1945 1.6529 5.585 2.04309L9.82719 6.28625C9.9998 6.45893 10.0963 6.67885 10.1162 6.90442C10.1436 7.19118 10.0468 7.48755 9.82719 7.70715L5.585 11.9503C5.19455 12.3402 4.56133 12.3403 4.17094 11.9503C3.78079 11.5599 3.78097 10.9267 4.17094 10.5363L7.70902 6.99622L4.17094 3.45715C3.78082 3.06673 3.78088 2.43355 4.17094 2.04309Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `
  }

  container.innerHTML = html

  // Add click handlers for rows - open detail view
  container.querySelectorAll('.cache-item[data-type]').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('stale')) return
      showDetailView(item.dataset.type)
    })
  })
}

/**
 * Get empty message for a tab
 */
function getEmptyMessage(tabName) {
  switch (tabName) {
    case 'party': return 'Browse a party in game to capture data'
    case 'collection': return 'Browse your collection pages to capture data'
    case 'database': return 'Browse detail pages to capture data'
    default: return 'No data available'
  }
}

/**
 * Handle clear cache
 */
async function handleClearCache() {
  await chrome.runtime.sendMessage({ action: 'clearCache' })
  selectedDataTypes = { party: null, collection: null, database: null }
  cachedStatus = null

  // Reset all tab displays
  for (const tabName of ['party', 'collection', 'database']) {
    const container = document.getElementById(`${tabName}Items`)
    if (container) {
      container.innerHTML = `<p class="cache-empty">${getEmptyMessage(tabName)}</p>`
    }
  }

  showTabStatus(activeTab, 'Cache cleared', 'info')
  setTimeout(() => hideTabStatus(activeTab), 2000)
}

// ==========================================
// DATA OPERATIONS
// ==========================================

/**
 * Handle export for a tab
 */
async function handleExport(tabName) {
  const dataType = selectedDataTypes[tabName]
  if (!dataType) {
    showTabStatus(tabName, 'Please select data to export', 'error')
    return
  }

  const exportBtn = document.getElementById(`export${capitalize(tabName)}`)
  if (exportBtn) exportBtn.disabled = true

  showTabStatus(tabName, 'Preparing export...', 'info')

  try {
    // Get cached data
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType
    })

    if (response.error) {
      showTabStatus(tabName, response.error, 'error')
      return
    }

    // Upload based on data type
    let uploadResponse
    if (dataType === 'party') {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadPartyData',
        data: response.data
      })
    } else if (dataType.startsWith('detail_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadDetailData',
        data: response.data,
        dataType
      })
    } else if (dataType.startsWith('collection_') || dataType.startsWith('list_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadCollectionData',
        data: response.data,
        dataType,
        updateExisting: false
      })
    } else {
      showTabStatus(tabName, 'Export not supported for this data type', 'error')
      return
    }

    if (uploadResponse.error) {
      showTabStatus(tabName, uploadResponse.error, 'error')
    } else if (uploadResponse.url) {
      chrome.tabs.create({ url: uploadResponse.url })
      window.close()
    } else if (uploadResponse.created !== undefined) {
      const msg = `Imported: ${uploadResponse.created} new, ${uploadResponse.updated} updated, ${uploadResponse.skipped} skipped`
      showTabStatus(tabName, msg, 'success')
      setTimeout(() => hideTabStatus(tabName), 4000)
    } else {
      showTabStatus(tabName, 'Export successful!', 'success')
      setTimeout(() => hideTabStatus(tabName), 2000)
    }
  } catch (error) {
    showTabStatus(tabName, 'Export failed: ' + error.message, 'error')
  } finally {
    if (exportBtn) exportBtn.disabled = false
  }
}

/**
 * Handle copy for a tab
 */
async function handleCopy(tabName) {
  const dataType = selectedDataTypes[tabName]
  if (!dataType) {
    showTabStatus(tabName, 'Please select data to copy', 'error')
    return
  }

  const copyBtn = document.getElementById(`copy${capitalize(tabName)}`)
  if (copyBtn) copyBtn.disabled = true

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType
    })

    if (response.error) {
      showTabStatus(tabName, response.error, 'error')
      return
    }

    const jsonString = JSON.stringify(response.data, null, 2)
    await navigator.clipboard.writeText(jsonString)

    showTabStatus(tabName, `${getDataTypeName(dataType)} data copied!`, 'success')
    setTimeout(() => hideTabStatus(tabName), 2000)
  } catch (error) {
    showTabStatus(tabName, 'Copy failed: ' + error.message, 'error')
  } finally {
    if (copyBtn) copyBtn.disabled = false
  }
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

/**
 * Handle messages from content script / background
 */
function handleMessages(message) {
  if (message.action === 'dataCaptured') {
    // Refresh cache status
    refreshAllCaches()

    // If detail view is open and showing this data type, refresh it
    if (detailViewActive && currentDetailDataType === message.dataType) {
      refreshDetailViewWithNewData()
    }

    // Show notification on the appropriate tab
    const tabName = getTabForDataType(message.dataType)
    if (tabName) {
      showTabStatus(tabName, `${getDataTypeName(message.dataType)} data captured!`, 'success')
      setTimeout(() => hideTabStatus(tabName), 2000)
    }
  }
}

/**
 * Get which tab a data type belongs to
 */
function getTabForDataType(dataType) {
  // Party types are dynamic, not in TAB_DATA_TYPES
  if (dataType.startsWith('party_')) {
    return 'party'
  }
  for (const [tab, types] of Object.entries(TAB_DATA_TYPES)) {
    if (types.includes(dataType)) return tab
  }
  return null
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Show status message in a tab
 */
function showTabStatus(tabName, message, type = 'info') {
  const notice = document.getElementById(`${tabName}Notice`)
  const status = document.getElementById(`${tabName}Status`)

  if (notice && status) {
    notice.classList.remove('hidden')
    notice.className = `notice status-${type}`
    status.textContent = message
  }
}

/**
 * Hide status message in a tab
 */
function hideTabStatus(tabName) {
  const notice = document.getElementById(`${tabName}Notice`)
  if (notice) {
    notice.classList.add('hidden')
  }
}

/**
 * Show status message in an element
 */
function showStatus(element, message, type = 'info') {
  if (!element) return
  element.textContent = message
  element.className = `status-${type}`
  show(element)
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Show a toast message
 */
let toastTimeout = null
function showToast(message) {
  const toast = document.getElementById('toast')
  if (!toast) return

  // Clear any existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout)
  }

  toast.textContent = message
  toast.classList.add('visible')

  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible')
  }, 2500)
}
