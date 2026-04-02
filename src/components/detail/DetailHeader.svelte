<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
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

  let importDisabled = $derived(
    app.importState === 'importing' || app.importState === 'imported'
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

  function goBack() {
    app.resetDetailState()
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
        // Check conflicts first for weapon/summon collections
        const selectedIndices = Array.from(app.selectedItems)
        response = await uploadCharacterStats(selectedIndices)
      } else if (isCollection || dataType.startsWith('list_') || dataType.startsWith('stash_')) {
        const selectedIndices = Array.from(app.selectedItems)

        // Check conflicts on first attempt for weapon/summon types
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

  function handleReview() {
    // Review is handled by parent/modal system
    // For now, mark as reviewed
    if (!app.pendingConflicts || app.pendingConflicts.length === 0) return
    // TODO: open conflict resolution modal
    app.importState = 'review'
  }
</script>

<div class="detail-header">
  <button class="back-button" onclick={goBack}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.5 13L5.5 8L10.5 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span>{m.action_back()}</span>
  </button>

  <div class="detail-actions">
    <CopyDropdown />

    {#if showReviewButton}
      <button
        class="detail-action-button review-button"
        class:imported={app.importState === 'review'}
        id="detailReview"
        onclick={handleReview}
      >
        {#if app.importState === 'review'}
          {m.action_reviewed()}
        {:else}
          {m.action_review()} ({app.pendingConflicts?.length})
        {/if}
      </button>
    {/if}

    {#if showSyncButton}
      <button
        class="detail-action-button sync-button"
        id="detailSync"
        disabled={app.importState === 'importing'}
      >
        {m.action_full_sync()}
      </button>
    {/if}

    {#if showImportButton}
      <button
        class="detail-action-button import-button"
        class:imported={app.importState === 'imported'}
        id="detailImport"
        disabled={importDisabled}
        onclick={handleImport}
      >
        {importLabel}
      </button>
    {/if}
  </div>
</div>
