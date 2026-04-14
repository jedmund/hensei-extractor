<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { uploadUnfScores } from '../../lib/services/chrome-messages.js'
  import Button from '../shared/Button.svelte'
  import CopyDropdown from './CopyDropdown.svelte'

  let hasCrew = $derived(!!app.auth?.hasCrew)

  const rounds = [
    { value: 'preliminaries', label: m.crew_round_preliminaries },
    { value: 'interlude', label: m.crew_round_interlude },
    { value: 'finals_day_1', label: m.crew_round_finals_1 },
    { value: 'finals_day_2', label: m.crew_round_finals_2 },
    { value: 'finals_day_3', label: m.crew_round_finals_3 },
    { value: 'finals_day_4', label: m.crew_round_finals_4 }
  ]

  let importLabel = $derived.by(() => {
    switch (app.importState) {
      case 'importing':
        return m.action_importing()
      case 'imported':
        return m.action_imported()
      default:
        return m.action_import()
    }
  })

  let importDisabled = $derived(
    app.importState === 'importing' || app.importState === 'imported'
  )

  async function handleImport() {
    const dataType = app.currentDetailDataType
    if (!dataType) return
    app.importState = 'importing'

    try {
      const result = await uploadUnfScores(dataType, app.crewImportRound)

      if (result.error) {
        if (result.error === 'not_in_crew') {
          app.showToast(m.crew_not_officer())
        } else if (result.error.includes('not found')) {
          app.showToast(m.crew_no_event())
        } else {
          app.showToast(m.toast_import_failed())
        }
        app.importState = 'idle'
      } else {
        let msg = m.crew_import_success({ count: result.imported ?? 0 })
        if (result.phantomsCreated && result.phantomsCreated > 0) {
          msg += m.crew_phantoms_created({
            phantoms: result.phantomsCreated
          })
        }
        app.showToast(msg)
        app.importState = 'imported'
      }
    } catch {
      app.showToast(m.toast_import_failed())
      app.importState = 'idle'
    }
  }
</script>

<div class="detail-actions">
  <CopyDropdown />

  {#if hasCrew}
    <select
      class="crew-round-select"
      bind:value={app.crewImportRound}
    >
      {#each rounds as round}
        <option value={round.value}>{round.label()}</option>
      {/each}
    </select>

    <Button
      size="small"
      class={app.importState === 'imported' ? 'imported' : ''}
      id="crewImport"
      disabled={importDisabled}
      onclick={handleImport}
    >
      {importLabel}
    </Button>
  {/if}
</div>

<style>
  .detail-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .crew-round-select {
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    font-size: 11px;
    outline: none;
    cursor: pointer;
  }

  .crew-round-select:focus {
    border-color: var(--color-accent);
  }
</style>
