/**
 * @fileoverview Detail view lifecycle management.
 */

import { showTabStatus } from "./helpers.js"
import { renderDetailItems, isCollectionType, isDatabaseDetailType, toArray, countItems } from "./rendering.js"
import { resetSelection } from "./selection.js"
import { resetRarityFilter, resetLv1Filter, setCurrentDataType, getFilterOptions } from "./filter.js"

// Detail view state
export let detailViewActive = false
export let currentDetailDataType = null

/**
 * Show detail view for a data type
 * @param {string} dataType - The data type to show
 * @param {object} cachedStatus - Cache status object
 * @param {string} activeTab - Currently active tab
 */
export async function showDetailView(dataType, cachedStatus, activeTab) {
  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType
  })

  if (response.error) {
    showTabStatus(activeTab, response.error, 'error')
    return
  }

  currentDetailDataType = dataType
  setCurrentDataType(dataType)

  // Update metadata
  const status = cachedStatus?.[dataType]
  document.getElementById('detailFreshness').textContent = status?.ageText || ''

  if (dataType.startsWith('party_')) {
    const deck = response.data.deck || {}
    const pc = deck.pc || {}
    const chars = toArray(deck.npc).filter(Boolean).length
    const wpns = toArray(pc.weapons).filter(Boolean).length
    const sums = toArray(pc.summons).filter(Boolean).length
    document.getElementById('detailPageCount').textContent = ''
    document.getElementById('detailItemCount').textContent = `${chars} characters · ${wpns} weapons · ${sums} summons`
  } else if (isDatabaseDetailType(dataType)) {
    const name = response.data.name || response.data.master?.name || ''
    document.getElementById('detailPageCount').textContent = ''
    document.getElementById('detailItemCount').textContent = name
  } else {
    document.getElementById('detailPageCount').textContent = status?.pageCount ? `${status.pageCount} pages` : ''
    document.getElementById('detailItemCount').textContent = `${status?.totalItems || countItems(dataType, response.data)} items`
  }

  // Reset import button
  const importBtn = document.getElementById('detailImport')
  if (importBtn) {
    importBtn.textContent = 'Import'
    importBtn.disabled = false
    importBtn.classList.remove('imported')
  }

  // Show/hide rarity filter and selection bar
  const filterEl = document.getElementById('detailFilter')
  const selectionBar = document.getElementById('detailSelectionBar')
  if (isCollectionType(dataType)) {
    filterEl?.classList.remove('hidden')
    selectionBar?.classList.remove('hidden')
    resetRarityFilter()
    resetLv1Filter(dataType)
    resetSelection()
  } else {
    filterEl?.classList.add('hidden')
    selectionBar?.classList.add('hidden')
  }

  // Render items
  renderDetailItems(dataType, response.data, getFilterOptions(detailViewActive))

  // Slide in
  document.getElementById('detailView').classList.add('active')
  detailViewActive = true
}

/**
 * Hide detail view
 */
export function hideDetailView() {
  document.getElementById('detailView').classList.remove('active')
  detailViewActive = false
  currentDetailDataType = null
  setCurrentDataType(null)

  document.getElementById('filterDropdown')?.classList.remove('open')
}

/**
 * Check if detail view is currently active
 */
export function isDetailViewActive() {
  return detailViewActive
}

/**
 * Get current detail data type
 */
export function getCurrentDetailDataType() {
  return currentDetailDataType
}
