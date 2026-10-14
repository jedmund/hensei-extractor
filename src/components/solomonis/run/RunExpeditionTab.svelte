<!-- The expedition log, laid out like hensei-web's expedition details: the
     outcome rows, the spaces reached, and the coin and shop totals. -->

<script lang="ts">
  import { reportEconomy, reportSpaceStats } from '../../../lib/solomonis/report-stats.js'
  import type { SolomonisReport } from '../../../lib/solomonis/types.js'
  import EconomySection from './EconomySection.svelte'
  import ExpeditionSection from './ExpeditionSection.svelte'
  import TraversalSection from './TraversalSection.svelte'

  interface Props {
    report: SolomonisReport
  }

  let { report }: Props = $props()

  let spaces = $derived(reportSpaceStats(report))
  let economy = $derived(reportEconomy(report))
</script>

<div class="expedition">
  <ExpeditionSection {report} />
  {#if spaces.length > 0}
    <TraversalSection stats={spaces} />
  {/if}
  {#if economy.pointsEarned != null || economy.shopPurchases != null}
    <EconomySection pointsEarned={economy.pointsEarned} shopPurchases={economy.shopPurchases} />
  {/if}
</div>

<style lang="scss">
  @use 'themes/spacing' as *;

  .expedition {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
  }
</style>
