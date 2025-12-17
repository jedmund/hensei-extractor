/**
 * @fileoverview Rarity and Lv1 filtering for collection views.
 */

import { renderDetailItems, isCollectionType, isWeaponOrSummonCollection, extractItems } from "./rendering.js"
import { selectedItems, currentItemIndexMap, setSelectedItems } from "./selection.js"
import { showToast } from "./helpers.js"

// Filter state
export let activeRarityFilters = new Set(['4']) // SSR shown by default
export let excludeLv1Items = true // Enabled by default

// Current detail data type (managed by detail.js but needed here)
let currentDataType = null

/**
 * Set the current data type (called by detail.js)
 */
export function setCurrentDataType(dataType) {
  currentDataType = dataType
}

/**
 * Get current filter options for rendering
 */
export function getFilterOptions(detailViewActive) {
  return {
    activeRarityFilters,
    excludeLv1Items,
    detailViewActive
  }
}

/**
 * Initialize filter dropdown event listeners
 */
export function initializeFilterListeners() {
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

  // Handle rarity checkbox changes
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

  updateFilterButtonLabel()

  if (currentDataType) {
    await refreshDetailView()
  }
}

/**
 * Update the filter button label based on active filters
 */
export function updateFilterButtonLabel() {
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
export function resetRarityFilter() {
  activeRarityFilters = new Set(['4'])
  const dropdown = document.getElementById('filterDropdown')
  dropdown?.querySelectorAll('input[type="checkbox"][value]').forEach(cb => {
    cb.checked = cb.value === '4'
  })
  updateFilterButtonLabel()
}

/**
 * Reset Lv1 filter and show/hide based on data type
 */
export function resetLv1Filter(dataType) {
  const lv1FilterOption = document.getElementById('lv1FilterOption')
  const lv1FilterDivider = document.getElementById('lv1FilterDivider')
  const lv1Checkbox = document.getElementById('excludeLv1Checkbox')

  if (isCollectionType(dataType) && isWeaponOrSummonCollection(dataType)) {
    lv1FilterOption?.classList.remove('hidden')
    lv1FilterDivider?.classList.remove('hidden')
    excludeLv1Items = true
    if (lv1Checkbox) lv1Checkbox.checked = true
  } else {
    lv1FilterOption?.classList.add('hidden')
    lv1FilterDivider?.classList.add('hidden')
    excludeLv1Items = false
  }
}

/**
 * Update Lv1 filter based on checkbox state
 */
async function updateLv1Filter() {
  const lv1Checkbox = document.getElementById('excludeLv1Checkbox')
  excludeLv1Items = lv1Checkbox?.checked ?? false

  if (currentDataType) {
    setSelectedItems(new Set()) // Clear to trigger fresh selection
    await refreshDetailView()
  }
}

/**
 * Refresh detail view with current data
 */
export async function refreshDetailView() {
  if (!currentDataType) return

  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType: currentDataType
  })

  if (!response.error) {
    renderDetailItems(currentDataType, response.data, getFilterOptions(true))
  }
}

/**
 * Refresh detail view when new data is captured
 * @param {function} refreshAllCaches - Cache refresh function
 * @param {object} cachedStatus - Cache status object
 */
export async function refreshDetailViewWithNewData(refreshAllCaches, cachedStatus) {
  if (!currentDataType) return

  const dataType = currentDataType
  const previousItemCount = currentItemIndexMap.length

  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType
  })

  if (response.error) return

  const data = response.data

  // Update metadata
  await refreshAllCaches()
  const status = cachedStatus?.[dataType]
  if (status) {
    document.getElementById('detailFreshness').textContent = status.ageText
    document.getElementById('detailPageCount').textContent = status.pageCount ? `${status.pageCount} pages` : ''
  }

  // Pre-select new SSR items
  const allItems = extractItems(dataType, data)
  const shouldExcludeLv1 = excludeLv1Items && isWeaponOrSummonCollection(dataType)

  let newSelectedCount = 0
  allItems.forEach((item, index) => {
    if (index >= previousItemCount) {
      const rarity = item.rarity || item.master?.rarity || item.param?.rarity
      if (String(rarity) === '4' || activeRarityFilters.has(String(rarity))) {
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

  renderDetailItems(dataType, data, getFilterOptions(true))

  if (newSelectedCount > 0) {
    showToast(`${newSelectedCount} new items added`)
  }
}
