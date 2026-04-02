<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
  import * as m from '../../paraglide/messages.js'
  import { getImageUrl } from '../../lib/constants.js'
  import { previewSyncDeletions, syncCollection } from '../../lib/services/chrome-messages.js'

  function getSyncPreviewImageUrl(granblueId: string | undefined): string {
    if (!granblueId) return ''
    const dt = app.currentDetailDataType ?? ''
    if (dt.includes('weapon')) return getImageUrl(`weapon-square/${granblueId}.jpg`)
    if (dt.includes('summon')) return getImageUrl(`summon-square/${granblueId}.jpg`)
    if (dt.includes('artifact')) return getImageUrl(`artifact-square/${granblueId}.jpg`)
    if (dt.includes('npc') || dt.includes('character')) return getImageUrl(`character-square/${granblueId}_01.jpg`)
    return ''
  }

  let preview = $derived(app.syncPreview)
  let previewItems = $derived((preview?.willDelete ?? []).slice(0, 12))
  let moreCount = $derived(preview && preview.count > 12 ? preview.count - 12 : 0)

  function cancel() {
    app.syncModalOpen = false
    app.syncPreview = null
  }

  async function confirm() {
    const dataType = app.currentDetailDataType
    if (!dataType) return

    app.syncModalOpen = false

    const deletionIds = (preview?.willDelete ?? [])
      .map((item) => item.granblue_id)
      .filter((id): id is string => !!id)

    const res = await syncCollection(dataType, [...app.selectedItems], deletionIds)

    app.syncPreview = null

    if (res.error) {
      app.showToast(res.error)
    } else {
      app.showToast(m.sync_result({ total: (res.data?.created ?? 0) + (res.data?.updated ?? 0) }))
    }
  }
</script>

{#if app.syncModalOpen}
<div class="modal-overlay">
  <div class="modal-backdrop" role="button" tabindex="-1" onclick={cancel} onkeydown={(e) => { if (e.key === 'Escape') cancel() }}></div>
  <div class="modal sync-modal">
    <h3 class="modal-title">{m.sync_modal_title()}</h3>
    <p class="modal-body">{m.sync_modal_body()}</p>

    {#if preview && preview.count > 0}
      <div class="sync-warning">
        <p>{m.sync_modal_warning()}</p>
      </div>

      <div class="sync-delete-list">
        <p class="delete-count">
          {preview.count > 1
            ? m.sync_delete_count_plural({ count: preview.count })
            : m.sync_delete_count({ count: preview.count })}
        </p>
        <div class="sync-delete-grid">
          {#each previewItems as item}
            <div class="sync-delete-item" title={item.name ?? 'Unknown'}>
              <img src={getSyncPreviewImageUrl(item.granblue_id)} alt={item.name ?? 'Unknown'} />
            </div>
          {/each}
        </div>
        {#if moreCount > 0}
          <p class="more-items">{m.sync_more_items({ count: moreCount })}</p>
        {/if}
      </div>
    {:else}
      <div class="sync-delete-list">
        <p class="no-deletions">{m.sync_no_deletions()}</p>
      </div>
    {/if}

    <div class="modal-actions">
      <button type="button" class="modal-btn modal-btn-cancel" onclick={cancel}>{m.action_cancel()}</button>
      <button type="button" class="modal-btn modal-btn-confirm" onclick={confirm}>{m.action_sync()}</button>
    </div>
  </div>
</div>
{/if}
