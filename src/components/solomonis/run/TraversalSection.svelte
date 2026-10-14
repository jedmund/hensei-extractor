<!-- How many of each kind of space an expedition visited, laid out in two
     columns with the game's icons, as in its report. Matches hensei-web's
     TraversalSection. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import type { SpaceStatKey } from '../../../lib/solomonis/report-stats.js'
  import DetailsSection from '../../shared/details/DetailsSection.svelte'
  import TraversalRow from './TraversalRow.svelte'

  interface Props {
    stats: { key: SpaceStatKey; count: number }[]
  }

  let { stats }: Props = $props()

  const SPACE_LABELS: Record<SpaceStatKey, () => string> = {
    battle: m.solomonis_extension_space_battle,
    strong: m.solomonis_extension_space_strong,
    terrifying: m.solomonis_extension_space_terrifying,
    ruler: m.solomonis_extension_space_ruler,
    boss: m.solomonis_extension_space_boss,
    event: m.solomonis_extension_space_event,
    healing: m.solomonis_extension_space_healing,
    chest: m.solomonis_extension_space_chest,
    teleporter: m.solomonis_extension_space_teleporter,
    special: m.solomonis_extension_space_special
  }
</script>

<DetailsSection title={m.solomonis_extension_spaces()}>
  <!-- Two columns like the game: combat spaces, then the rest -->
  <ul class="space-grid">
    {#each stats as stat (stat.key)}
      <li>
        <TraversalRow space={stat.key} label={SPACE_LABELS[stat.key]()} count={stat.count} />
      </li>
    {/each}
  </ul>
</DetailsSection>

<style lang="scss">
  @use 'themes/spacing' as *;

  // Two columns of five, separated by space alone
  .space-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(5, auto);
    grid-auto-flow: column;
    column-gap: $unit-3x;
    row-gap: $unit-half;
    margin: 0;
    padding: 0 $unit;
    list-style: none;
  }
</style>
