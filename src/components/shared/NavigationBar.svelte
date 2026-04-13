<!-- NavigationBar Component -->

<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title?: string
    left?: Snippet
    center?: Snippet
    right?: Snippet
    class?: string
  }

  let { title, left, center, right, class: className }: Props = $props()
</script>

<header class="navigation-bar {className || ''}">
  <div class="navigation-bar-left">
    {#if left}{@render left()}{/if}
  </div>
  <span class="navigation-bar-title">
    {#if center}{@render center()}{:else}{title ?? ''}{/if}
  </span>
  <div class="navigation-bar-right">
    {#if right}{@render right()}{/if}
  </div>
</header>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/effects' as *;

  .navigation-bar {
    display: flex;
    align-items: center;
    height: $unit-6x;
    padding: 0 $unit-2x;
    background: white;
    flex-shrink: 0;
    position: relative;
  }

  .navigation-bar-left,
  .navigation-bar-right {
    display: flex;
    align-items: center;
    gap: $unit;
    flex: 1;
    min-width: 0;
  }

  .navigation-bar-right {
    justify-content: flex-end;
  }

  .navigation-bar-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: $font-button;
    font-weight: $medium;
    color: var(--color-text);
    white-space: nowrap;
    pointer-events: none;

    :global(> *) {
      pointer-events: auto;
    }
  }
</style>
