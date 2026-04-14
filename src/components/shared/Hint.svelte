<script lang="ts">
  import { onMount } from 'svelte'
  import { app } from '../../lib/state/app.svelte.js'
  import Icon from './Icon.svelte'

  interface Props {
    hints: string[]
    hasUpdateBanner?: boolean
  }

  let { hints, hasUpdateBanner = false }: Props = $props()

  let currentIndex = $state(0)
  let loaded = $state(false)
  let dismissing = $state(false)

  const isFirst = $derived(currentIndex === 0)
  const isLast = $derived(currentIndex === hints.length - 1)
  const hasMultiple = $derived(hints.length > 1)

  onMount(async () => {
    const result = await chrome.storage.local.get('hintsEnabled')
    app.hintsEnabled = result.hintsEnabled !== false
    loaded = true
  })

  function dismiss() {
    dismissing = true
  }

  function onSlideOutEnd() {
    if (dismissing) {
      app.hintsEnabled = false
      chrome.storage.local.set({ hintsEnabled: false })
      dismissing = false
    }
  }

  function prev() {
    if (!isFirst) currentIndex--
  }

  function next() {
    if (!isLast) currentIndex++
  }

  // Reset index when hints change
  $effect(() => {
    hints
    currentIndex = 0
  })
</script>

{#if loaded && app.hintsEnabled && hints.length > 0}
  <div class="hint" class:hint-above-banner={hasUpdateBanner} class:hint-dismissing={dismissing} onanimationend={onSlideOutEnd}>
    <button class="hint-close" onclick={dismiss}>
      <Icon name="close" size={12} />
    </button>

    <div class="hint-pages">
      {#each hints as hint, i (i)}
        <p class="hint-text" class:hint-text-active={i === currentIndex}>{hint}</p>
      {/each}
    </div>

    {#if hasMultiple}
      <div class="hint-footer">
        <button class="hint-nav" onclick={prev} disabled={isFirst}>
          <Icon name="chevron-left" size={14} />
        </button>
        <span class="hint-indicator">{currentIndex + 1} / {hints.length}</span>
        <button class="hint-nav" onclick={next} disabled={isLast}>
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    {/if}
  </div>
{/if}
