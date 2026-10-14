<!-- The Arcarum Blessings the Evoker's party deck has equipped, under their
     total cost against the limit. Like hensei-web's BlessingSection. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import type { DeckBlessings } from '../../../lib/solomonis/blessings.js'
  import DetailsSection from '../../shared/details/DetailsSection.svelte'
  import BlessingRow from './BlessingRow.svelte'

  interface Props {
    blessings: DeckBlessings
  }

  let { blessings }: Props = $props()

  let costSuffix = $derived(
    blessings.totalCost != null && blessings.maxCost != null
      ? `(${blessings.totalCost} / ${blessings.maxCost})`
      : undefined
  )
</script>

<DetailsSection
  title={m.solomonis_extension_blessings()}
  titleSuffix={costSuffix}
  empty={blessings.blessings.length === 0}
  emptyMessage={m.solomonis_extension_blessings_none()}
>
  <ul class="blessing-list">
    {#each blessings.blessings as blessing (blessing.slug)}
      <li><BlessingRow {blessing} /></li>
    {/each}
  </ul>
</DetailsSection>

<style lang="scss">
  @use 'themes/spacing' as *;

  .blessing-list {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
    margin: 0;
    padding: 0 $unit;
    list-style: none;
  }
</style>
