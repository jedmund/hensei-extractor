<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import type { FormattedCacheStatus } from '../../lib/types/cache.js'

  interface Props {
    status: FormattedCacheStatus
    dataType: string
    onclick: () => void
  }

  let { status, dataType, onclick }: Props = $props()

  const isStash = $derived(dataType.startsWith('stash_'))
  const displayName = $derived(
    (status as any).partyName || status.displayName
  )
</script>

<button
  class="cache-item {status.statusClass}"
  data-type={dataType}
  onclick={status.statusClass !== 'stale' ? onclick : undefined}
  disabled={status.statusClass === 'stale'}
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
      <svg class="icon-chevron" viewBox="0 0 14 14" fill="currentColor">
        <path
          d="M4.17094 2.04309C4.56138 1.6528 5.1945 1.6529 5.585 2.04309L9.82719 6.28625C9.9998 6.45893 10.0963 6.67885 10.1162 6.90442C10.1436 7.19118 10.0468 7.48755 9.82719 7.70715L5.585 11.9503C5.19455 12.3402 4.56133 12.3403 4.17094 11.9503C3.78079 11.5599 3.78097 10.9267 4.17094 10.5363L7.70902 6.99622L4.17094 3.45715C3.78082 3.06673 3.78088 2.43355 4.17094 2.04309Z"
          fill="currentColor"
        />
      </svg>
    </span>
  </div>
</button>
