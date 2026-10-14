<!-- How many of each kind of space the expedition reached, in two columns
     with the game's icons, as in its report. Matches hensei-web's
     TraversalSection. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import type { SpaceStatKey } from '../../../lib/solomonis/report-stats.js'
  import ExpeditionStatRow from './ExpeditionStatRow.svelte'

  interface Props {
    stats: { key: SpaceStatKey; count: number }[]
  }

  let { stats }: Props = $props()

  const labels: Record<SpaceStatKey, () => string> = {
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

<div class="party-section">
  <h3 class="party-section-title">{m.solomonis_extension_spaces()}</h3>
  <ul class="space-grid">
    {#each stats as stat (stat.key)}
      <li>
        <ExpeditionStatRow
          label={labels[stat.key]()}
          count={stat.count}
          icon={getImageUrl(`${BUCKET.solomonisSpaces}/${stat.key}.png`)}
        />
      </li>
    {/each}
  </ul>
</div>

<style lang="scss">
  @use 'themes/spacing' as *;

  // Two columns of five: combat spaces, then the rest
  .space-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(5, auto);
    grid-auto-flow: column;
    column-gap: $unit-2x;
    row-gap: $unit-half;
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
