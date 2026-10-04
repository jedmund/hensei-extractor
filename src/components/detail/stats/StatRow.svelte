<script lang="ts">
  import type { StatValue } from '../../../lib/item-stats.js'
  import Stars from './Stars.svelte'

  interface Props {
    label: string
    value: StatValue
  }

  let { label, value }: Props = $props()
</script>

<div class="stat-row"><span class="stat-label">{label}</span><span class="stat-value">{#if value.kind === 'text'}{value.text}{:else if value.kind === 'icons'}{#each value.icons as icon}<img class="stat-icon" src={icon.src} alt={icon.alt}>{/each}{:else}<Stars stars={value.stars} />{/if}</span></div>
