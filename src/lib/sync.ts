/**
 * Sync functionality for the Granblue Fantasy Chrome extension.
 * Handles the full sync flow: preview deletions, show confirmation modal, execute sync.
 */

import { getImageUrl } from './constants.js'
import { t, tError } from './i18n.js'

interface SyncPreviewItem {
  name?: string
  granblue_id?: string
}

interface SyncPreview {
  count: number
  willDelete: SyncPreviewItem[]
}

interface SyncReconciliation {
  deleted: number
  orphaned_grid_items?: unknown[]
}

interface SyncUploadResponse {
  error?: string
  created: number
  updated: number
  reconciliation?: SyncReconciliation
}

let pendingSyncData: unknown = null

export async function handleDetailSync(
  currentDetailDataType: string | null,
  showToast: (msg: string) => void
): Promise<void> {
  if (!currentDetailDataType) return

  const syncBtn = document.getElementById(
    'detailSync'
  ) as HTMLButtonElement | null
  if (syncBtn) {
    syncBtn.disabled = true
    syncBtn.textContent = t('action_checking')
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast(t('toast_sync_failed', { error: tError(response.error) }))
      return
    }

    pendingSyncData = response.data

    const previewResponse = await chrome.runtime.sendMessage({
      action: 'previewSyncDeletions',
      data: response.data,
      dataType: currentDetailDataType
    })

    if (previewResponse.error) {
      showToast(
        t('toast_preview_failed', { error: tError(previewResponse.error) })
      )
      return
    }

    updateSyncModalContent(
      previewResponse as SyncPreview,
      currentDetailDataType
    )
    showSyncModal()
  } catch (error) {
    showToast(t('toast_sync_failed', { error: (error as Error).message }))
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false
      syncBtn.textContent = t('action_full_sync')
    }
  }
}

function updateSyncModalContent(
  preview: SyncPreview,
  currentDetailDataType: string
): void {
  const warningDiv = document.getElementById('syncWarning')
  const deleteListDiv = document.getElementById('syncDeleteList')

  if (preview.count > 0) {
    warningDiv?.classList.remove('hidden')

    const itemsHtml = preview.willDelete
      .slice(0, 12)
      .map((item) => {
        const name = item.name ?? 'Unknown'
        const imageUrl = getSyncPreviewImageUrl(
          item.granblue_id,
          currentDetailDataType
        )
        return `
        <div class="sync-delete-item" title="${name}">
          <img src="${imageUrl}" alt="${name}">
        </div>
      `
      })
      .join('')

    const moreCount =
      preview.count > 12
        ? `<p class="more-items">${t('sync_more_items', { count: preview.count - 12 })}</p>`
        : ''

    const deleteCountText =
      preview.count > 1
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
    warningDiv?.classList.add('hidden')
    if (deleteListDiv) {
      deleteListDiv.innerHTML = `<p class="no-deletions">${t('sync_no_deletions')}</p>`
      deleteListDiv.classList.remove('hidden')
    }
  }
}

function getSyncPreviewImageUrl(
  granblueId: string | undefined,
  currentDetailDataType: string
): string {
  if (!granblueId) return ''

  if (currentDetailDataType.includes('weapon')) {
    return getImageUrl(`weapon-square/${granblueId}.jpg`)
  }
  if (currentDetailDataType.includes('summon')) {
    return getImageUrl(`summon-square/${granblueId}.jpg`)
  }
  if (currentDetailDataType.includes('artifact')) {
    return getImageUrl(`artifact-square/${granblueId}.jpg`)
  }
  if (
    currentDetailDataType.includes('npc') ||
    currentDetailDataType.includes('character')
  ) {
    return getImageUrl(`character-square/${granblueId}_01.jpg`)
  }
  return ''
}

function showSyncModal(): void {
  const modal = document.getElementById('syncModal')
  modal?.classList.remove('hidden')
}

export function hideSyncModal(): void {
  const modal = document.getElementById('syncModal')
  modal?.classList.add('hidden')
  pendingSyncData = null
}

export async function confirmSync(
  currentDetailDataType: string | null,
  showToast: (msg: string) => void
): Promise<void> {
  const dataType = currentDetailDataType
  const data = pendingSyncData
  hideSyncModal()

  if (!dataType || !data) return

  const syncBtn = document.getElementById(
    'detailSync'
  ) as HTMLButtonElement | null
  if (syncBtn) {
    syncBtn.disabled = true
    syncBtn.textContent = t('action_syncing')
  }

  try {
    const uploadResponse = (await chrome.runtime.sendMessage({
      action: 'uploadCollectionData',
      data,
      dataType,
      updateExisting: true,
      isFullInventory: true,
      reconcileDeletions: true
    })) as SyncUploadResponse

    if (uploadResponse.error) {
      showToast(tError(uploadResponse.error))
    } else {
      const total = uploadResponse.created + uploadResponse.updated
      let msg = t('sync_result', { total })

      if (uploadResponse.reconciliation) {
        const { deleted, orphaned_grid_items } = uploadResponse.reconciliation
        if (deleted > 0) {
          msg += t('sync_removed', { count: deleted })
        }
        if (orphaned_grid_items && orphaned_grid_items.length > 0) {
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
    showToast(t('toast_sync_failed', { error: (error as Error).message }))
  } finally {
    if (syncBtn && !syncBtn.classList.contains('synced')) {
      syncBtn.disabled = false
      syncBtn.textContent = t('action_full_sync')
    }
  }
}
