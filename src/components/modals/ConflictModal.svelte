<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
  import * as m from '../../paraglide/messages.js'
  import { getImageUrl } from '../../lib/constants.js'
  import Button from '../shared/Button.svelte'

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
<div class="modal">
  <div class="modal-backdrop" role="button" tabindex="-1" onclick={close} onkeydown={(e) => { if (e.key === 'Escape') close() }}></div>
  <div class="modal-content">
    <h3 class="modal-title">{m.conflict_modal_title()}</h3>
    <div class="modal-body">
      <div id="conflictItemDisplay">
        {#if currentItem}
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
        {/if}
      </div>
      <p class="conflict-message">{m.conflict_modal_message()}</p>
      {#if currentItem}
        <div class="conflict-nav">
          <button type="button" class="conflict-nav-btn" aria-label="Previous" disabled={currentIndex === 0} onclick={() => navigate(-1)}>&lsaquo;</button>
          <span id="conflictCounter">{currentIndex + 1} / {conflicts.length}</span>
          <button type="button" class="conflict-nav-btn" aria-label="Next" disabled={currentIndex === conflicts.length - 1} onclick={() => navigate(1)}>&rsaquo;</button>
        </div>
      {/if}
    </div>
    <div class="modal-actions conflict-actions">
      <div class="conflict-bulk">
        <Button size="small" onclick={skipAll}>{m.conflict_skip_all()}</Button>
        <Button size="small" onclick={importAll}>{m.conflict_import_all()}</Button>
      </div>
      {#if currentItem}
        <div class="conflict-item-actions">
          <Button size="small" active={currentDecision === 'skip'} onclick={() => decide('skip')}>
            {m.conflict_skip()}
          </Button>
          <Button size="small" active={currentDecision === 'import'} onclick={() => decide('import')}>
            {m.action_import()}
          </Button>
        </div>
      {/if}
      <Button variant="primary" size="small" id="conflictFinish" disabled={!allDecided} onclick={finish}>
        {allDecided ? m.action_done() : m.conflict_decided({ count: decisions.size, total: conflicts.length })}
      </Button>
    </div>
  </div>
</div>
{/if}
