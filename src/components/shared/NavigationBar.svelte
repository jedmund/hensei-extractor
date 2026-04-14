<!-- NavigationBar Component -->

<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title?: string
    subtitle?: string
    scrolled?: boolean
    bordered?: boolean
    left?: Snippet
    center?: Snippet
    right?: Snippet
    class?: string
  }

  let { title, subtitle, scrolled = false, bordered = false, left, center, right, class: className }: Props = $props()
</script>

<header class="navigation-bar {className || ''}" class:bordered class:scrolled>
  <div class="navigation-bar-left">
    {#if left}{@render left()}{/if}
  </div>
  <span class="navigation-bar-title" class:has-subtitle={!!subtitle}>
    {#if center}
      {@render center()}
    {:else}
      <span class="navigation-bar-title-text">{title ?? ''}</span>
      {#if subtitle}
        <span class="navigation-bar-subtitle">{subtitle}</span>
      {/if}
    {/if}
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
    z-index: 10;
    &.bordered {
      border-bottom: 1px solid var(--color-border-light, rgba(0, 0, 0, 0.08));
      @include smooth-transition($duration-quick, box-shadow, border-color);
    }

    &.bordered.scrolled {
      border-bottom-color: transparent;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.18);
    }
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
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
    white-space: nowrap;
    pointer-events: none;

    &.has-subtitle {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }

    :global(> *) {
      pointer-events: auto;
    }
  }

  .navigation-bar-subtitle {
    font-size: $font-tiny;
    font-weight: $normal;
    color: var(--color-text-tertiary);
    line-height: 1.2;
  }
</style>
