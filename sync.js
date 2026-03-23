/**
 * @fileoverview Sync functionality for the Granblue Fantasy Chrome extension.
 * Handles the full sync flow: preview deletions, show confirmation modal, execute sync.
 */

import { getImageUrl } from './constants.js'
import { t } from './i18n.js'

// Internal state for pending sync operations
let pendingSyncData = null
let pendingSyncPreview = null

/**
 * Handle sync button click - fetch preview then show modal
 * @param {string} currentDetailDataType - The current detail data type
 * @param {Function} showToast - Toast notification function
 */
export async function handleDetailSync(currentDetailDataType, showToast) {
  if (!currentDetailDataType) return

  const syncBtn = document.getElementById('detailSync')
  if (syncBtn) {
    syncBtn.disabled = true
    syncBtn.textContent = t('action_checking')
  }

  try {
    // Get cached data (all pages)
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast(t('toast_sync_failed', { error: response.error }))
      return
    }

    pendingSyncData = response.data

    // Call preview endpoint to see what will be deleted
    const previewResponse = await chrome.runtime.sendMessage({
      action: 'previewSyncDeletions',
      data: response.data,
      dataType: currentDetailDataType
    })

    if (previewResponse.error) {
      showToast(t('toast_preview_failed', { error: previewResponse.error }))
      return
    }

    pendingSyncPreview = previewResponse

    // Update modal content with preview
    updateSyncModalContent(previewResponse, currentDetailDataType)
    showSyncModal()
  } catch (error) {
    showToast(t('toast_sync_failed', { error: error.message }))
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false
      syncBtn.textContent = t('action_full_sync')
    }
  }
}

/**
 * Update sync modal content based on preview
 */
function updateSyncModalContent(preview, currentDetailDataType) {
  const warningDiv = document.getElementById('syncWarning')
  const deleteListDiv = document.getElementById('syncDeleteList')

  if (preview.count > 0) {
    // Show warning and grid of items to delete
    warningDiv.classList.remove('hidden')

    // Build the grid of items with images
    const itemsHtml = preview.willDelete.slice(0, 12).map(item => {
      const name = item.name || `Unknown`
      const imageUrl = getSyncPreviewImageUrl(item.granblue_id, currentDetailDataType)
      return `
        <div class="sync-delete-item" title="${name}">
          <img src="${imageUrl}" alt="${name}">
        </div>
      `
    }).join('')

    const moreCount = preview.count > 12
      ? `<p class="more-items">${t('sync_more_items', { count: preview.count - 12 })}</p>`
      : ''

    const deleteCountText = preview.count > 1
      ? t('sync_delete_count_plural', { count: preview.count })
      : t('sync_delete_count', { count: preview.count })

    if (deleteListDiv) {
      deleteListDiv.innerHTML = `
        <p class="delete-count">${deleteCountText}</p>
        <div class="sync-delete-grid">${itemsHtml}</div>
        ${moreCount}
      `
      deleteListDiv.classList.remove('hidden')
    }
  } else {
    // No deletions, hide warning
    warningDiv.classList.add('hidden')
    if (deleteListDiv) {
      deleteListDiv.innerHTML = `<p class="no-deletions">${t('sync_no_deletions')}</p>`
      deleteListDiv.classList.remove('hidden')
    }
  }
}

/**
 * Get image URL for sync preview based on current data type
 */
function getSyncPreviewImageUrl(granblueId, currentDetailDataType) {
  if (!granblueId) return ''

  if (currentDetailDataType?.includes('weapon')) {
    return getImageUrl(`weapon-square/${granblueId}.jpg`)
  }
  if (currentDetailDataType?.includes('summon')) {
    return getImageUrl(`summon-square/${granblueId}.jpg`)
  }
  if (currentDetailDataType?.includes('artifact')) {
    return getImageUrl(`artifact-square/${granblueId}.jpg`)
  }
  if (currentDetailDataType?.includes('npc') || currentDetailDataType?.includes('character')) {
    return getImageUrl(`character-square/${granblueId}_01.jpg`)
  }
  return ''
}

/**
 * Show sync confirmation modal
 */
function showSyncModal() {
  const modal = document.getElementById('syncModal')
  modal?.classList.remove('hidden')
}

/**
 * Hide sync confirmation modal and clear pending data
 */
export function hideSyncModal() {
  const modal = document.getElementById('syncModal')
  modal?.classList.add('hidden')
  pendingSyncData = null
  pendingSyncPreview = null
}

/**
 * Confirm and execute full sync with reconciliation
 * @param {string} currentDetailDataType - The current detail data type
 * @param {Function} showToast - Toast notification function
 */
export async function confirmSync(currentDetailDataType, showToast) {
  // Save references before hiding modal (which clears pending data)
  const dataType = currentDetailDataType
  const data = pendingSyncData
  hideSyncModal()

  if (!dataType || !data) return

  const syncBtn = document.getElementById('detailSync')
  if (syncBtn) {
    syncBtn.disabled = true
    syncBtn.textContent = t('action_syncing')
  }

  try {
    // Upload with full sync options (update existing + reconcile deletions)
    const uploadResponse = await chrome.runtime.sendMessage({
      action: 'uploadCollectionData',
      data: data,
      dataType: dataType,
      updateExisting: true,
      isFullInventory: true,
      reconcileDeletions: true
    })

    if (uploadResponse.error) {
      showToast(uploadResponse.error)
    } else {
      // Show sync results
      const total = uploadResponse.created + uploadResponse.updated
      let msg = t('sync_result', { total })

      if (uploadResponse.reconciliation) {
        const { deleted, orphaned_grid_items } = uploadResponse.reconciliation
        if (deleted > 0) {
          msg += t('sync_removed', { count: deleted })
        }
        if (orphaned_grid_items?.length > 0) {
          msg += t('sync_orphaned', { count: orphaned_grid_items.length })
        }
      }

      showToast(msg)

      if (syncBtn) {
        syncBtn.textContent = t('action_synced')
        syncBtn.classList.add('synced')
      }
    }
  } catch (error) {
    showToast(t('toast_sync_failed', { error: error.message }))
  } finally {
    if (syncBtn && !syncBtn.classList.contains('synced')) {
      syncBtn.disabled = false
      syncBtn.textContent = t('action_full_sync')
    }
  }
}
