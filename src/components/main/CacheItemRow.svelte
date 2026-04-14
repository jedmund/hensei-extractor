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
  const isDatabase = $derived(dataType.startsWith('detail_'))
  const displayName = $derived(
    status.partyName || status.displayName
  )
  const databaseTag = $derived.by(() => {
    if (dataType.startsWith('detail_npc')) return m.type_character()
    if (dataType.startsWith('detail_weapon')) return m.type_weapon()
    if (dataType.startsWith('detail_summon')) return m.type_summon()
    return ''
  })
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
    {#if isDatabase && databaseTag}
      <span class="cache-subtitle">{databaseTag}</span>
    {:else if status.subtitle}
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
