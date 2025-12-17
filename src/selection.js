/**
 * @fileoverview Item selection/checkbox logic for collection views.
 */

// Selection state - exported for use by other modules
export let selectedItems = new Set()
export let currentItemIndexMap = [] // Maps filtered index to original index

/**
 * Reset selection state (called when opening detail view)
 */
export function resetSelection() {
  selectedItems = new Set()
  currentItemIndexMap = []
}

/**
 * Set the item index map (called during rendering)
 */
export function setItemIndexMap(map) {
  currentItemIndexMap = map
}

/**
 * Set selected items (called during rendering)
 */
export function setSelectedItems(items) {
  selectedItems = items
}

/**
 * Toggle item selection
 */
export function toggleItemSelection(index, checkbox) {
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
export function updateSelectionCount() {
  const countEl = document.getElementById('detailItemCount')
  if (countEl) {
    const total = document.querySelectorAll('#detailItems .item-checkbox').length
    // Count only visible selected items (using currentItemIndexMap)
    const visibleSelectedCount = currentItemIndexMap.filter(idx => selectedItems.has(idx)).length
    countEl.textContent = `${visibleSelectedCount}/${total} selected`
  }
}

/**
 * Handle Select All button click
 */
export function handleSelectAll() {
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
export function handleUnselectAll() {
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
