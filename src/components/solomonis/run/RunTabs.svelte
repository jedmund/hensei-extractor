<!-- The run view's tabs. Each label carries a check once its capture is in,
     or an empty circle while it's still missing. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import {
    RUN_TABS,
    runTabStep,
    type SolomonisRunTab,
    type SolomonisStep
  } from '../../../lib/solomonis/steps.js'
  import Icon from '../../shared/Icon.svelte'
  import Segment from '../../shared/segmented-control/Segment.svelte'
  import SegmentedControl from '../../shared/segmented-control/SegmentedControl.svelte'

  interface Props {
    value: SolomonisRunTab
    steps: SolomonisStep[]
  }

  let { value = $bindable(), steps }: Props = $props()

  const labels: Record<SolomonisRunTab, () => string> = {
    party: m.solomonis_extension_tab_party,
    expedition: m.solomonis_extension_tab_expedition,
    guidebooks: m.solomonis_extension_tab_guidebooks
  }
</script>

<SegmentedControl bind:value variant="background" size="small" grow>
  {#each RUN_TABS as tab (tab)}
    {@const captured = !!runTabStep(steps, tab)?.captured}
    <Segment value={tab}>
      <span class="tab">
        <span class="mark" class:captured aria-hidden="true">
          {#if captured}<Icon name="check" size={10} />{/if}
        </span>
        {labels[tab]()}
        <span class="visually-hidden">
          ({captured
            ? m.solomonis_extension_log_captured()
            : m.solomonis_extension_log_missing()})
        </span>
      </span>
    </Segment>
  {/each}
</SegmentedControl>

<style lang="scss">
  @use 'themes/spacing' as *;

  .tab {
    display: inline-flex;
    align-items: center;
    gap: $unit-half;
    min-width: 0;
  }

  .mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border: 1px solid var(--color-text-tertiary);
    border-radius: 50%;
    box-sizing: border-box;
  }

  .mark.captured {
    border-color: var(--color-text);
    background: var(--color-text);
    color: var(--color-bg);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
