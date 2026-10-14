<!-- The Arcarum Blessings the Evoker's party deck has equipped, as cards
     side by side, under their total cost against the limit. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import type { DeckBlessings } from '../../../lib/solomonis/blessings.js'
  import DetailsSection from '../../shared/details/DetailsSection.svelte'
  import BlessingCard from './BlessingCard.svelte'

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
  <ul class="blessing-cards">
    {#each blessings.blessings as blessing (blessing.slug)}
      <li><BlessingCard {blessing} /></li>
    {/each}
  </ul>
</DetailsSection>

<style lang="scss">
  @use 'themes/spacing' as *;

  // Side by side, four to a row
  .blessing-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: $unit * 1.5;
    margin: 0;
    padding: 0 $unit;
    list-style: none;
  }
</style>
