<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import Button from '../shared/Button.svelte'
  import {
    uploadPartyData,
    uploadCollectionData,
    uploadDetailData,
    uploadCharacterStats,
    checkConflicts
  } from '../../lib/services/chrome-messages.js'
  import {
    isCollectionType,
    isWeaponOrSummonCollection
  } from '../../lib/detail-helpers.js'
  import { previewSyncDeletions } from '../../lib/services/chrome-messages.js'
  import CopyDropdown from './CopyDropdown.svelte'

  let dataType = $derived(app.currentDetailDataType ?? '')
  let isParty = $derived(dataType.startsWith('party_'))
  let isDatabase = $derived(dataType.startsWith('detail_'))
  let isCharStats = $derived(dataType === 'character_stats')
  let isCollection = $derived(
    isCollectionType(dataType) && dataType !== 'character_stats'
  )

  let showSyncButton = $derived(isCollection && app.enableFullSync)
  let showImportButton = $derived(!showSyncButton)
  let showReviewButton = $derived(
    app.pendingConflicts !== null && app.pendingConflicts.length > 0
  )

  let importLabel = $derived.by(() => {
    switch (app.importState) {
      case 'importing':
        return m.action_importing()
      case 'imported':
        return m.action_imported()
      case 'checking':
        return m.action_checking()
      default:
        return m.action_import()
    }
  })

  let hasSelectableItems = $derived(isCollection || isCharStats)
  let importDisabled = $derived(
    app.importState === 'importing' ||
    app.importState === 'imported' ||
    (hasSelectableItems && app.selectedItems.size === 0)
  )

  function supportsConflictCheck(dt: string): boolean {
    return (
      dt === 'collection_weapon' ||
      dt === 'collection_summon' ||
      dt === 'list_weapon' ||
      dt === 'list_summon' ||
      dt.startsWith('stash_weapon') ||
      dt.startsWith('stash_summon')
    )
  }

  async function handleImport() {
    if (!dataType) return
    app.importState = 'importing'

    try {
      let response: { error?: string; url?: string; created?: number; updated?: number } | undefined

      if (isParty) {
        response = await uploadPartyData({
          dataType,
          name: app.partyName?.trim() || undefined,
          raid: app.selectedRaid ?? undefined,
          visibility: app.selectedVisibility,
          shareWithCrew: app.shareWithCrew,
          playlists: app.selectedPlaylists
        })
      } else if (isDatabase) {
        response = await uploadDetailData(dataType)
      } else if (isCharStats) {
        const selectedIndices = Array.from(app.selectedItems)
        response = await uploadCharacterStats(selectedIndices)
      } else if (isCollection || dataType.startsWith('list_') || dataType.startsWith('stash_')) {
        const selectedIndices = Array.from(app.selectedItems)

        if (
          supportsConflictCheck(dataType) &&
          !app.conflictResolutions &&
          !app.pendingConflicts
        ) {
          app.importState = 'checking'
          const conflictResponse = await checkConflicts(dataType, selectedIndices)
          const conflicts = conflictResponse?.conflicts
          if (conflicts && conflicts.length > 0) {
            app.pendingConflicts = conflicts
            app.importState = 'idle'
            app.showToast(
              conflicts.length > 1
                ? m.toast_items_need_review({ count: conflicts.length })
                : m.toast_item_needs_review({ count: conflicts.length })
            )
            return
          }
        }

        if (app.pendingConflicts && !app.conflictResolutions) {
          app.showToast(m.toast_review_conflicts())
          app.importState = 'idle'
          return
        }

        response = await uploadCollectionData(
          dataType,
          selectedIndices,
          app.conflictResolutions
        )
      } else {
        app.showToast(m.toast_import_not_supported())
        app.importState = 'idle'
        return
      }

      if (response?.error) {
        app.showToast(m.toast_import_failed())
        app.importState = 'idle'
      } else if (response?.url) {
        chrome.tabs.create({ url: response.url })
        app.showToast(m.toast_opening_party())
        app.importState = 'imported'
      } else if (response?.created !== undefined) {
        const total = response.created + (response.updated || 0)
        app.showToast(m.toast_imported_items({ total }))
        app.importState = 'imported'
      } else {
        app.showToast(m.toast_import_success())
        app.importState = 'imported'
      }
    } catch {
      app.showToast(m.toast_import_failed())
      app.importState = 'idle'
    }
  }

  async function handleSync() {
    if (!dataType) return
    const res = await previewSyncDeletions(dataType)
    if (res.error) {
      app.showToast(res.error)
      return
    }
    app.syncPreview = {
      count: res.count ?? 0,
      willDelete: (res.willDelete ?? []) as Array<{ name?: string; granblue_id?: string }>
    }
    app.syncModalOpen = true
  }

  function handleReview() {
    if (!app.pendingConflicts || app.pendingConflicts.length === 0) return
    app.conflictModalOpen = true
  }
</script>

<div class="detail-actions">
  <CopyDropdown />

  {#if showReviewButton}
    <Button
      size="small"
      id="detailReview"
      onclick={handleReview}
    >
      {m.action_review()} ({app.pendingConflicts?.length})
    </Button>
  {/if}

  {#if showSyncButton}
    <Button
      size="small"
      id="detailSync"
      disabled={app.importState === 'importing'}
      onclick={handleSync}
    >
      {m.action_full_sync()}
    </Button>
  {/if}

  {#if showImportButton}
    <Button
      size="small"
      class={app.importState === 'imported' ? 'imported' : ''}
      id="detailImport"
      disabled={importDisabled}
      onclick={handleImport}
    >
      {importLabel}
    </Button>
  {/if}
</div>
