<!-- The expedition log: outcome, pledge, turns and guidebook size, when the
     run ended, the spaces it reached, and its shop and coin totals. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { reportEconomy, reportSpaceStats } from '../../../lib/solomonis/report-stats.js'
  import type { SolomonisReport } from '../../../lib/solomonis/types.js'
  import ExpeditionSpaces from './ExpeditionSpaces.svelte'
  import ExpeditionStatRow from './ExpeditionStatRow.svelte'

  interface Props {
    report: SolomonisReport
  }

  let { report }: Props = $props()

  let summary = $derived.by(() => {
    const parts: string[] = []
    if (typeof report.is_success === 'boolean') {
      parts.push(
        report.is_success
          ? m.solomonis_extension_outcome_cleared()
          : m.solomonis_extension_outcome_failed()
      )
    }
    const pledge = report.difficulty
    if (typeof pledge === 'number') {
      parts.push(
        pledge > 0
          ? m.solomonis_extension_pledge({ level: pledge })
          : m.solomonis_extension_no_pledge()
      )
    }
    const turns = Number(report.total_turn)
    if (report.total_turn != null && Number.isFinite(turns)) {
      parts.push(m.solomonis_extension_turns({ count: turns }))
    }
    if (typeof report.spacebook_status_count === 'number') {
      parts.push(
        m.solomonis_extension_guidebook_stacks({
          count: report.spacebook_status_count
        })
      )
    }
    return parts
  })

  let endedAt = $derived(typeof report.ended_at === 'string' ? report.ended_at : null)
  let spaces = $derived(reportSpaceStats(report))
  let economy = $derived(reportEconomy(report))
</script>

<section class="expedition">
  <div class="party-section summary">
    {#if summary.length > 0}
      <p class="summary-line">{summary.join(' · ')}</p>
    {/if}
    {#if endedAt}
      <p class="summary-ended">{m.solomonis_extension_ended({ date: endedAt })}</p>
    {/if}
  </div>

  {#if spaces.length > 0}
    <ExpeditionSpaces stats={spaces} />
  {/if}

  {#if economy.shopPurchases != null || economy.pointsEarned != null}
    <div class="party-section">
      <h3 class="party-section-title">{m.solomonis_extension_economy()}</h3>
      {#if economy.shopPurchases != null}
        <ExpeditionStatRow
          label={m.solomonis_extension_shop_purchases()}
          count={economy.shopPurchases}
        />
      {/if}
      {#if economy.pointsEarned != null}
        <ExpeditionStatRow
          label={m.solomonis_extension_points_earned()}
          count={economy.pointsEarned}
        />
      {/if}
    </div>
  {/if}
</section>

<style lang="scss">
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .summary {
    display: flex;
    flex-direction: column;
    gap: $unit-half;
  }

  .summary-line,
  .summary-ended {
    margin: 0;
    font-size: $font-small;
  }

  .summary-line {
    color: var(--color-text);
    font-weight: $medium;
  }

  .summary-ended {
    color: var(--color-text-secondary);
  }
</style>
