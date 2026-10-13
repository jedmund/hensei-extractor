<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { isSolomonisRunDataType } from '../../lib/solomonis/routes.js'
  import { matchingRuns } from '../../lib/solomonis/steps.js'
  import CacheItemRow from '../main/CacheItemRow.svelte'

  interface Props {
    /** The open deck (`solomonis_deck_<priority>`) */
    dataType: string
    /** The deck's route Evoker */
    evokerId: string | null
  }

  let { dataType, evokerId }: Props = $props()

  // The captured reports run with this deck's Evoker: the other side of a
  // report's deck pairing (D26). Opening one imports it as a run with this
  // deck as its current setup, which the user can still change there.
  let runs = $derived(
    matchingRuns(
      Object.entries(app.cachedStatus)
        .filter(([type, status]) => isSolomonisRunDataType(type) && status.available)
        .map(([type, status]) => ({ ...status, dataType: type })),
      evokerId
    )
  )

  function openRun(runDataType: string) {
    const deck = dataType
    app.resetDetailState()
    app.currentDetailDataType = runDataType
    app.solomonisSetupDataType = deck
    app.detailViewActive = true
  }
</script>

<section class="reports" aria-live="polite">
  <h3 class="section-label">{m.solomonis_extension_reports_label()}</h3>
  {#if runs.length > 0}
    <p class="note">{m.solomonis_extension_reports_found()}</p>
    <div class="runs">
      {#each runs as run (run.dataType)}
        <CacheItemRow status={run} dataType={run.dataType} onclick={() => openRun(run.dataType)} />
      {/each}
    </div>
  {:else}
    <p class="note">{m.solomonis_extension_reports_hint()}</p>
  {/if}
</section>

<style lang="scss">
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .reports {
    display: flex;
    flex-direction: column;
    gap: $unit;
    margin-top: $unit-2x;
  }

  .section-label {
    margin: 0;
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
  }

  .note {
    margin: 0;
    font-size: $font-small;
    color: var(--color-text-secondary);
  }

  .runs {
    display: flex;
    flex-direction: column;
  }
</style>
