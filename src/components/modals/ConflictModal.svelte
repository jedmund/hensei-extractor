<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
  import * as m from '../../paraglide/messages.js'
  import { getImageUrl } from '../../lib/constants.js'

  type ConflictDecision = 'import' | 'skip'
  interface ConflictItem {
    game_id: string
    granblue_id?: string
    name: string
  }

  let currentIndex = $state(0)
  let decisions = $state(new Map<string, ConflictDecision>())

  let conflicts = $derived((app.pendingConflicts ?? []) as ConflictItem[])
  let currentItem = $derived(conflicts[currentIndex])
  let currentDecision = $derived(currentItem ? decisions.get(currentItem.game_id) : undefined)
  let allDecided = $derived(conflicts.length > 0 && conflicts.every((c) => decisions.has(c.game_id)))

  $effect(() => {
    if (app.conflictModalOpen) {
      currentIndex = 0
      decisions = new Map()
    }
  })

  function getConflictImageUrl(granblueId: string | undefined): string {
    if (!granblueId) return ''
    const dt = app.currentDetailDataType ?? ''
    if (dt.includes('weapon')) return getImageUrl(`weapon-square/${granblueId}.jpg`)
    if (dt.includes('summon')) return getImageUrl(`summon-square/${granblueId}.jpg`)
    if (dt.includes('character') || dt.includes('npc')) return getImageUrl(`character-square/${granblueId}_01.jpg`)
    return ''
  }

  function navigate(dir: number) {
    const next = currentIndex + dir
    if (next >= 0 && next < conflicts.length) currentIndex = next
  }

  function decide(decision: ConflictDecision) {
    if (!currentItem) return
    const updated = new Map(decisions)
    updated.set(currentItem.game_id, decision)
    decisions = updated

    // Auto-advance to next undecided
    const nextUndecided = findNextUndecided(currentIndex)
    if (nextUndecided !== -1) currentIndex = nextUndecided
  }

  function findNextUndecided(from: number): number {
    for (let i = from + 1; i < conflicts.length; i++) {
      if (!decisions.has(conflicts[i]!.game_id)) return i
    }
    for (let i = 0; i < from; i++) {
      if (!decisions.has(conflicts[i]!.game_id)) return i
    }
    return -1
  }

  function importAll() {
    const updated = new Map(decisions)
    for (const item of conflicts) updated.set(item.game_id, 'import')
    decisions = updated
  }

  function skipAll() {
    const updated = new Map(decisions)
    for (const item of conflicts) updated.set(item.game_id, 'skip')
    decisions = updated
  }

  function finish() {
    if (!allDecided) return
    const result: Record<string, ConflictDecision> = {}
    for (const [k, v] of decisions) result[k] = v
    app.conflictResolutions = result
    app.conflictModalOpen = false
    app.pendingConflicts = null
  }

  function close() {
    app.conflictModalOpen = false
    app.pendingConflicts = null
  }
</script>

{#if app.conflictModalOpen && conflicts.length > 0}
<div class="modal-overlay">
  <div class="modal-backdrop" role="button" tabindex="-1" onclick={close} onkeydown={(e) => { if (e.key === 'Escape') close() }}></div>
  <div class="modal conflict-modal">
    <h3 class="modal-title">{m.conflict_modal_title()}</h3>
    <p class="modal-body">{m.conflict_modal_message()}</p>

    {#if currentItem}
      <div class="conflict-item-display">
        <div class="conflict-item">
          <div class="conflict-item-image">
            {#if getConflictImageUrl(currentItem.granblue_id)}
              <img src={getConflictImageUrl(currentItem.granblue_id)} alt={currentItem.name} />
            {/if}
            {#if currentDecision === 'import'}
              <span class="conflict-badge conflict-badge-import">{m.action_import()}</span>
            {:else if currentDecision === 'skip'}
              <span class="conflict-badge conflict-badge-skip">{m.conflict_skip()}</span>
            {/if}
          </div>
          <p class="conflict-item-name">{currentItem.name}</p>
        </div>
      </div>

      <div class="conflict-nav">
        <button type="button" class="conflict-prev" aria-label="Previous" disabled={currentIndex === 0} onclick={() => navigate(-1)}>
          <svg viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M9.53 2.47a.75.75 0 0 1 .073.976l-.073.084L5.06 8l4.47 4.47a.75.75 0 0 1-.976 1.133l-.084-.073-5-5a.75.75 0 0 1-.073-.976l.073-.084 5-5a.75.75 0 0 1 1.06 0z"/></svg>
        </button>
        <span class="conflict-counter">{currentIndex + 1} / {conflicts.length}</span>
        <button type="button" class="conflict-next" aria-label="Next" disabled={currentIndex === conflicts.length - 1} onclick={() => navigate(1)}>
          <svg viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M4.47 2.47a.75.75 0 0 0-.073.976l.073.084L8.94 8l-4.47 4.47a.75.75 0 0 0 .976 1.133l.084-.073 5-5a.75.75 0 0 0 .073-.976l-.073-.084-5-5a.75.75 0 0 0-1.06 0z"/></svg>
        </button>
      </div>

      <div class="conflict-actions">
        <button type="button" class="conflict-btn conflict-skip-btn" class:active={currentDecision === 'skip'} onclick={() => decide('skip')}>
          {m.conflict_skip()}
        </button>
        <button type="button" class="conflict-btn conflict-import-btn" class:active={currentDecision === 'import'} onclick={() => decide('import')}>
          {m.action_import()}
        </button>
      </div>
    {/if}

    <div class="conflict-bulk-actions">
      <button type="button" class="conflict-bulk-btn" onclick={skipAll}>{m.conflict_skip_all()}</button>
      <button type="button" class="conflict-bulk-btn" onclick={importAll}>{m.conflict_import_all()}</button>
    </div>

    <div class="modal-actions">
      <button type="button" class="modal-btn modal-btn-confirm conflict-finish" disabled={!allDecided} onclick={finish}>
        {allDecided ? m.action_done() : m.conflict_decided({ count: decisions.size, total: conflicts.length })}
      </button>
    </div>
  </div>
</div>
{/if}
