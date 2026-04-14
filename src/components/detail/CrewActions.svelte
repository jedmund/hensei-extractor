<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { uploadUnfScores } from '../../lib/services/chrome-messages.js'
  import Button from '../shared/Button.svelte'
  import CopyDropdown from './CopyDropdown.svelte'

  type ElementName = 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark'
  let element = $derived((app.auth?.avatar?.element as ElementName) ?? undefined)
  let hasCrew = $derived(!!app.auth?.hasCrew)

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
    <Button
      size="small"
      {element}
      elementStyle
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
</style>
