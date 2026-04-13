<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import type { FormattedCacheStatus } from '../../lib/types/cache.js'
  import Icon from '../shared/Icon.svelte'

  interface Props {
    status: FormattedCacheStatus
    dataType: string
    onclick: () => void
  }

  let { status, dataType, onclick }: Props = $props()

  const isStash = $derived(dataType.startsWith('stash_'))
  const displayName = $derived(
    status.partyName || status.displayName
  )
</script>

<button
  class="cache-item {status.statusClass}"
  data-type={dataType}
  onclick={() => { if (status.statusClass !== 'stale') onclick() }}
>
  <div class="cache-info">
    <div class="cache-name-row">
      <span class="cache-name">{displayName}</span>
      {#if isStash}
        <span class="stash-tag">{m.tag_stash()}</span>
      {/if}
    </div>
    {#if status.subtitle}
      <span class="cache-subtitle">{status.subtitle}</span>
    {/if}
  </div>
  <div class="cache-right">
    <span class="cache-age">{status.ageText}</span>
    <span class="cache-detail-btn" aria-label="View details">
      <Icon name="chevron-right" size={14} />
    </span>
  </div>
</button>
