<!-- The expedition log, laid out like hensei-web's expedition details: the
     outcome rows, the Blessings, the spaces reached, and the coin and shop
     totals. The report leaves the Blessings out, so they come from the
     Evoker's captured party deck, with a notice when there isn't one. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import type { DeckBlessings } from '../../../lib/solomonis/blessings.js'
  import { reportEconomy, reportSpaceStats } from '../../../lib/solomonis/report-stats.js'
  import type { SolomonisReport } from '../../../lib/solomonis/types.js'
  import BlessingSection from './BlessingSection.svelte'
  import EconomySection from './EconomySection.svelte'
  import ExpeditionSection from './ExpeditionSection.svelte'
  import GoToPartyNotice from './GoToPartyNotice.svelte'
  import TraversalSection from './TraversalSection.svelte'

  interface Props {
    report: SolomonisReport
    /** Whether a party deck for the run's Evoker was captured */
    hasDeck: boolean
    /** The deck's equipped Blessings, once it has loaded */
    blessings: DeckBlessings | null
    /** The game page that captures the Evoker's deck, when known */
    partyPage: string | null
  }

  let { report, hasDeck, blessings, partyPage }: Props = $props()

  let spaces = $derived(reportSpaceStats(report))
  let economy = $derived(reportEconomy(report))
</script>

<div class="expedition">
  <ExpeditionSection {report} />
  {#if !hasDeck}
    <GoToPartyNotice message={m.solomonis_extension_note_without_blessings()} page={partyPage} />
  {:else if blessings}
    <BlessingSection {blessings} />
  {/if}
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
