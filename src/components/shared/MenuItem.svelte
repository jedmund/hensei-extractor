<!-- MenuItem Component -->

<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet
    href?: string
    variant?: 'default' | 'destructive'
    disabled?: boolean
    onclick?: (e: MouseEvent) => void
    class?: string
  }

  let {
    children,
    href,
    variant = 'default',
    disabled = false,
    onclick,
    class: className
  }: Props = $props()

  const itemClass = $derived(
    ['menu-item', variant !== 'default' && variant, className || '']
      .filter(Boolean)
      .join(' ')
  )
</script>

{#if href}
  <a class={itemClass} {href} onclick={disabled ? (e) => e.preventDefault() : onclick}>
    {@render children()}
  </a>
{:else}
  <button type="button" class={itemClass} {disabled} {onclick}>
    {@render children()}
  </button>
{/if}

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;
  @use 'themes/effects' as *;

  :global(.menu-item) {
    display: flex;
    align-items: center;
    padding: $unit calc($unit * 1.5);
    border-radius: $bubble-menu-item-corner;
    font-size: $font-button;
    font-weight: $medium;
    color: var(--color-text);
    cursor: pointer;
    outline: none;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
    text-decoration: none;
    font-family: inherit;
    @include smooth-transition($duration-quick, background-color);
    user-select: none;

    &:hover {
      background-color: var(--color-bg);
      text-decoration: none;
    }

    &:focus-visible {
      background-color: var(--color-bg);
      outline: 2px solid #275dc5;
      outline-offset: -2px;
    }
  }

  :global(.menu-item.destructive) {
    color: var(--color-error);
  }

  :global(.menu-item.destructive:hover) {
    background-color: var(--color-error-light);
  }

  :global(.menu-item:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
