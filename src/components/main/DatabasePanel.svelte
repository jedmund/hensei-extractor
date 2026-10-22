<script lang="ts">
  import { onMount } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { formatAge, npcDetailDisplayName } from '../../lib/cache.js'
  import { translateError } from '../../lib/i18n.js'
  import {
    clearImportQueue,
    getImportQueue,
    importQueueAll
  } from '../../lib/services/chrome-messages.js'
  import type { ImportQueueState } from '../../lib/background/database-queue.js'
  import type {
    QueueEntry,
    QueueItemType
  } from '../../lib/background/import-queue.js'
  import type { ImportProgress } from '../../lib/background/import-runner.js'
  import type { FormattedCacheStatus } from '../../lib/types/cache.js'
  import Button from '../shared/Button.svelte'
  import EmptyState from '../shared/EmptyState.svelte'
  import CacheItemRow from './CacheItemRow.svelte'

  const TYPE_LABELS: Record<QueueItemType, () => string> = {
    npc: m.type_character,
    weapon: m.type_weapon,
    summon: m.type_summon
  }

  const COUNT_LABELS: Array<[QueueItemType, () => string]> = [
    ['npc', m.queue_type_characters],
    ['weapon', m.queue_type_weapons],
    ['summon', m.queue_type_summons]
  ]

  let queue = $state<ImportQueueState | null>(null)
  let progress = $state<ImportProgress | null>(null)
  let clearModalOpen = $state(false)
  let now = $state(Date.now())

  const entries = $derived(queue?.entries ?? [])
  const counts = $derived(queue?.counts ?? null)
  const visible = $derived(app.activeTab === 'database' && !app.detailViewActive)
  const progressPercent = $derived(
    progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0
  )

  async function refresh() {
    const state = await getImportQueue()
    if (!state?.entries) return
    queue = state
    if (state.progress) progress = state.progress
    now = Date.now()
  }

  // Reload when the tab is shown, including on the way back from a detail view
  $effect(() => {
    if (visible) refresh()
  })

  // Keep the capture ages current while the tab is shown
  $effect(() => {
    if (!visible) return
    const interval = setInterval(() => (now = Date.now()), 30000)
    return () => clearInterval(interval)
  })

  onMount(() => {
    function onMessage(message: {
      action: string
      dataType?: string
      progress?: ImportProgress | null
    }) {
      if (message.action === 'dataCaptured' && message.dataType?.startsWith('detail_')) {
        refresh()
      } else if (message.action === 'importQueueProgress') {
        progress = message.progress ?? null
        refresh()
      }
    }
    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  })

  function rowStatus(entry: QueueEntry): FormattedCacheStatus {
    const age = Math.max(0, now - entry.capturedAt)
    const tags = [
      TYPE_LABELS[entry.type](),
      entry.lang === 'jp' ? m.queue_lang_jp() : m.queue_lang_en()
    ]
    if (entry.style > 1) tags.push(m.tag_style_shift())
    if (entry.status === 'importing') tags.push(m.action_importing())
    if (entry.status === 'failed') tags.push(m.queue_status_failed())
    return {
      available: true,
      isStale: false,
      age,
      timestamp: entry.capturedAt,
      style: entry.style,
      // A later style shows its own name, e.g. Super Cidala
      displayName:
        entry.type === 'npc'
          ? npcDetailDisplayName(entry.name, entry.style, entry.styleName)
          : entry.name,
      subtitle: tags.join(' · '),
      ageText: formatAge(age),
      statusClass: 'available'
    }
  }

  function openDetail(entry: QueueEntry) {
    app.currentDetailDataType = `detail_${entry.key}`
    app.detailViewActive = true
  }

  async function handleImportAll() {
    if (progress || !counts?.total) return
    progress = { done: 0, total: counts.total, imported: 0, failed: 0 }

    try {
      const result = await importQueueAll()
      if (result.error === 'already_running') return
      if (result.error) {
        app.showToast(translateError(result.error))
      } else if (result.stoppedBy) {
        app.showToast(
          result.stoppedBy === 'forbidden'
            ? translateError('forbidden')
            : m.toast_import_failed_session()
        )
      } else if (result.failed) {
        app.showToast(
          m.queue_import_result({
            imported: result.imported ?? 0,
            failed: result.failed
          })
        )
      } else {
        app.showToast(m.toast_imported_items({ total: result.imported ?? 0 }))
      }
    } catch {
      app.showToast(m.toast_import_failed())
    } finally {
      progress = null
      await refresh()
    }
  }

  async function handleClear() {
    clearModalOpen = false
    await clearImportQueue()
    await refresh()
    app.showToast(m.queue_cleared())
  }
</script>

<div
  class="panel"
  class:active={app.activeTab === 'database'}
  id="databasePanel"
>
  {#if counts && counts.total > 0}
    <div class="queue-header">
      <div class="queue-counts">
        {#each COUNT_LABELS as [type, label] (type)}
          {@const byLang = counts.byType[type]}
          {#if byLang.en + byLang.jp > 0}
            <span class="queue-count">
              {label()} {byLang.en + byLang.jp}
              <span class="queue-count-langs">
                ({m.queue_lang_en()} {byLang.en} · {m.queue_lang_jp()} {byLang.jp})
              </span>
            </span>
          {/if}
        {/each}
      </div>
      <div class="queue-actions">
        <Button size="small" disabled={!!progress} onclick={() => (clearModalOpen = true)}>
          {m.queue_clear()}
        </Button>
        <Button size="small" variant="primary" disabled={!!progress} onclick={handleImportAll}>
          {m.queue_import_all()}
        </Button>
      </div>
      {#if progress}
        <div class="queue-progress" role="status">
          <span class="queue-progress-text">
            {m.queue_importing_progress({ done: progress.done, total: progress.total })}
          </span>
          <div
            class="queue-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <div class="queue-progress-fill" style:width="{progressPercent}%"></div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="cache-items" id="databaseItems">
    {#if entries.length === 0}
      <EmptyState message={m.empty_database()}>
        {#snippet actions()}
          <Button size="small" onclick={() => chrome.tabs.create({ url: 'https://game.granbluefantasy.jp/#archive/top' })}>
            {m.empty_journal()}
          </Button>
        {/snippet}
      </EmptyState>
    {:else}
      {#each entries as entry (entry.key)}
        <CacheItemRow
          status={rowStatus(entry)}
          dataType={`detail_${entry.key}`}
          error={entry.status === 'failed' && entry.error ? translateError(entry.error) : undefined}
          onclick={() => openDetail(entry)}
        />
      {/each}
    {/if}
  </div>
</div>

{#if clearModalOpen}
  <div class="modal">
    <div
      class="modal-backdrop"
      role="button"
      tabindex="-1"
      onclick={() => (clearModalOpen = false)}
      onkeydown={(e) => { if (e.key === 'Escape') clearModalOpen = false }}
    ></div>
    <div class="modal-content">
      <h3 class="modal-title">{m.queue_clear_title()}</h3>
      <div class="modal-body">
        <p>{m.queue_clear_body({ count: counts?.total ?? 0 })}</p>
      </div>
      <div class="modal-actions">
        <Button onclick={() => (clearModalOpen = false)}>{m.action_cancel()}</Button>
        <Button variant="destructive" onclick={handleClear}>{m.queue_clear()}</Button>
      </div>
    </div>
  </div>
{/if}
