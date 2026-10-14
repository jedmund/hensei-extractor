<!-- The expedition's untitled first section, as in hensei-web's
     ExpeditionSection: outcome, pledge, turns, guidebook size and when the
     run ended. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { reportEndedAt, reportTurns } from '../../../lib/solomonis/report-stats.js'
  import type { SolomonisReport } from '../../../lib/solomonis/types.js'
  import DetailRow from '../../shared/details/DetailRow.svelte'
  import OutcomeLabel from './OutcomeLabel.svelte'

  interface Props {
    report: SolomonisReport
  }

  let { report }: Props = $props()

  let pledge = $derived(
    typeof report.difficulty === 'number'
      ? report.difficulty > 0
        ? String(report.difficulty)
        : m.solomonis_extension_no_pledge()
      : null
  )
  let turns = $derived(reportTurns(report))
  let endedAt = $derived(reportEndedAt(report))
</script>

<div class="expedition-section">
  {#if typeof report.is_success === 'boolean'}
    <DetailRow label={m.solomonis_extension_outcome()}>
      <OutcomeLabel success={report.is_success} />
    </DetailRow>
  {/if}
  {#if pledge != null}
    <DetailRow label={m.solomonis_extension_pledge_label()} value={pledge} />
  {/if}
  {#if turns != null}
    <DetailRow label={m.solomonis_extension_turns_label()} value={turns} />
  {/if}
  {#if typeof report.spacebook_status_count === 'number'}
    <DetailRow
      label={m.solomonis_extension_guidebook_stacks_label()}
      value={report.spacebook_status_count}
    />
  {/if}
  {#if endedAt}
    <DetailRow label={m.solomonis_extension_ended_label()} value={endedAt} />
  {/if}
</div>

<style lang="scss">
  .expedition-section {
    display: flex;
    flex-direction: column;
  }
</style>
