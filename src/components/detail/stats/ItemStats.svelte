<script lang="ts">
  import type { StatRowData } from '../../../lib/item-stats.js'
  import StatRow from './StatRow.svelte'

  /** The database detail stat table, with the item's flavour text below it */
  interface Props {
    rows: StatRowData[]
    /** Comment lines (see commentLines); shown below the rows */
    comment?: string[]
  }

  let { rows, comment = [] }: Props = $props()
</script>

<div class="database-stats">
  {#each rows as row}
    <StatRow label={row.label} value={row.value} />
  {/each}
  {#if comment.length > 0}
    <div class="stat-row stat-comment"><span class="stat-value">{#each comment as line, i}{#if i > 0}<br>{/if}{line}{/each}</span></div>
  {/if}
</div>
