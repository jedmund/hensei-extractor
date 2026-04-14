<!-- Button Component (ported from hensei-svelte) -->

<script lang="ts">
  import { Button as ButtonPrimitive } from 'bits-ui'
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  interface Props {
    variant?:
      | 'primary'
      | 'secondary'
      | 'ghost'
      | 'element'
      | 'element-ghost'
      | 'text'
      | 'destructive'
      | 'destructive-ghost'
      | 'notice'
      | 'subtle'
      | 'raised'
      | undefined
    size?: 'small' | 'medium' | 'large' | 'icon' | undefined
    contained?: boolean | undefined
    element?: 'wind' | 'fire' | 'water' | 'earth' | 'dark' | 'light' | undefined
    elementStyle?: boolean | undefined
    active?: boolean | undefined
    save?: boolean | undefined
    saved?: boolean | undefined
    fullWidth?: boolean | undefined
    iconOnly?: boolean | undefined
    class?: string | undefined
    children?: Snippet | undefined
    leftIcon?: string | undefined
    rightIcon?: string | undefined
    leftAccessory?: Snippet | undefined
    rightAccessory?: Snippet | undefined
    disabled?: boolean | undefined
    href?: string | undefined
    onclick?: ((e: MouseEvent) => void) | undefined
    shape?: 'default' | 'circular' | 'circle' | 'pill' | undefined
    [key: string]: unknown
  }

  const {
    variant = 'secondary',
    size = 'medium',
    contained = false,
    element,
    elementStyle = false,
    active = false,
    save = false,
    saved = false,
    fullWidth = false,
    iconOnly = false,
    class: className = '',
    children,
    leftIcon,
    rightIcon,
    leftAccessory,
    rightAccessory,
    disabled = false,
    href,
    onclick,
    shape = 'default',
    ...restProps
  }: Props = $props()

  const normalizedShape = $derived(shape === 'circle' ? 'circular' : shape)

  const buttonClass = $derived(
    [
      'button',
      variant,
      size,
      contained && 'contained',
      element,
      elementStyle && element && 'element-styled',
      active && 'active',
      save && 'save',
      saved && 'saved',
      fullWidth && 'full',
      iconOnly && 'iconOnly',
      normalizedShape !== 'default' && normalizedShape,
      className
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

<ButtonPrimitive.Root class={buttonClass} {disabled} {href} {onclick} {...restProps}>
  {#if leftIcon}
    <span class="accessory">
      <Icon name={leftIcon} size={14} />
    </span>
  {:else if leftAccessory}
    <span class="accessory">
      {@render leftAccessory()}
    </span>
  {/if}

  {#if children && !iconOnly}
    <span class="text">
      {@render children()}
    </span>
  {:else if iconOnly && children}
    {@render children()}
  {/if}

  {#if rightIcon}
    <span class="accessory">
      <Icon name={rightIcon} size={14} />
    </span>
  {:else if rightAccessory}
    <span class="accessory">
      {@render rightAccessory()}
    </span>
  {/if}
</ButtonPrimitive.Root>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/effects' as *;
  @use 'themes/layout' as *;

  // Reset browser defaults for Bits UI button
  :global([data-button-root]) {
    all: unset;
    display: inline-flex;
    box-sizing: border-box;
    cursor: pointer;
  }

  // Base button styles
  :global([data-button-root].button) {
    align-items: center;
    justify-content: center;
    gap: $unit-three-quarter;
    user-select: none;
    text-decoration: none;
    line-height: 1;
    position: relative;
    white-space: nowrap;
    border: none;
    border-radius: $input-corner;
    font-size: $font-small;
    font-weight: $medium;
    background: var(--button-bg);
    color: var(--button-text);
    padding: calc($unit * 1.5) $unit-2x;
    font-family: inherit;
    @include smooth-transition($duration-zoom, background-color, color, border-color);

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &:focus-visible {
      outline: 2px solid #275dc5;
      outline-offset: 2px;
    }
  }

  // Inner elements
  :global([data-button-root] .text) {
    align-items: center;
    color: inherit;
    display: flex;
  }

  :global([data-button-root] .accessory) {
    display: flex;
    align-items: center;

    :global(svg) {
      fill: currentColor;
      height: 1em;
      width: 1em;
    }
  }

  // Ensure icons inherit button text color
  :global([data-button-root] .icon) {
    color: inherit;

    :global(svg) {
      fill: currentColor;
    }
  }

  // Variants
  :global([data-button-root].primary) {
    background-color: var(--button-contained-bg);
    color: var(--button-text-hover);

    &:hover:not(:disabled) {
      background-color: var(--button-contained-bg-hover);
    }
  }

  :global([data-button-root].secondary) {
    background-color: var(--button-bg);
    color: var(--button-text);

    &:hover:not(:disabled) {
      background-color: var(--button-bg-hover);
      color: var(--button-text-hover);
    }
  }

  :global([data-button-root].ghost) {
    background-color: transparent;
    color: var(--color-text-secondary);

    &:hover:not(:disabled) {
      background-color: var(--ghost-hover-bg, var(--button-bg));
      color: var(--color-text);
    }
  }

  :global([data-button-root].subtle) {
    background-color: var(--card-bg, white);
    color: var(--color-text);
    border: 1px solid var(--button-bg);

    &:hover:not(:disabled) {
      background-color: var(--button-bg-hover);
      border-color: var(--button-bg-hover);
    }
  }

  :global([data-button-root].raised) {
    background-color: var(--card-bg, white);
    color: var(--color-text);

    &:hover:not(:disabled) {
      background-color: var(--button-bg-hover);
    }
  }

  :global([data-button-root].text) {
    background-color: transparent;
    color: var(--color-link);
    padding: 0;
    min-height: auto;
    border: none;

    &:hover:not(:disabled) {
      text-decoration: underline;
    }
  }

  :global([data-button-root].destructive) {
    background: var(--color-error);
    color: white;

    &:hover:not(:disabled) {
      background: #b82e2e;
    }
  }

  :global([data-button-root].destructive-ghost) {
    background: transparent;
    color: var(--color-error);

    &:hover:not(:disabled) {
      background: var(--color-error-light);
    }
  }

  :global([data-button-root].notice) {
    background-color: var(--notice-button-bg);
    color: var(--notice-button-text);

    &:hover:not(:disabled) {
      background-color: var(--notice-button-bg-hover);
    }
  }

  // Sizes
  :global([data-button-root].small) {
    padding: $unit;
    font-size: $font-small;
    min-height: calc($unit * 3.5);
  }

  :global([data-button-root].medium) {
    height: calc($unit * 5.5);
    padding: $unit ($unit * 2.5);
    font-size: 1.6rem;
  }

  :global([data-button-root].large) {
    font-size: $font-large;
    padding: $unit-2x $unit-3x;
    min-height: calc($unit * 6.5);
  }

  :global([data-button-root].icon) {
    aspect-ratio: 1 / 1;
    padding: calc($unit * 1.5);
    height: calc($unit * 5.5);
    width: calc($unit * 5.5);
  }

  // Shapes
  :global([data-button-root].circular),
  :global([data-button-root].pill) {
    border-radius: $full-corner;
  }

  // Modifiers
  :global([data-button-root].contained) {
    background: var(--button-contained-bg);
    color: var(--button-contained-text, var(--button-text));

    &:hover:not(:disabled) {
      background: var(--button-contained-bg-hover);
    }
  }

  :global([data-button-root].active) {
    background: var(--button-bg-hover);
    color: var(--button-text-hover);
  }

  :global([data-button-root].full) {
    width: 100%;
  }

  // Icon only buttons - must come after size definitions for proper specificity
  :global([data-button-root].iconOnly) {
    gap: 0;
    aspect-ratio: 1;
    padding: calc($unit * 1.5);
  }

  :global([data-button-root].iconOnly.small) {
    padding: $unit !important;
    width: 30px;
    height: 30px;
  }

  :global([data-button-root].iconOnly.medium) {
    padding: calc($unit * 1.5) !important;
    width: calc($unit * 5.5);
    height: calc($unit * 5.5);
  }

  :global([data-button-root].iconOnly.large) {
    padding: $unit-2x !important;
    width: calc($unit * 6.5);
    height: calc($unit * 6.5);
  }

  // Save button special states
  :global([data-button-root].save) {
    :global(.accessory svg) {
      fill: none;
      stroke: currentColor;
    }

    &:hover:not(:disabled) {
      color: #ff4d4d;
    }
  }

  :global([data-button-root].saved) {
    color: #ff4d4d;

    :global(.accessory svg) {
      fill: #ff4d4d;
      stroke: #ff4d4d;
    }

    &:hover:not(:disabled) {
      :global(.accessory svg) {
        fill: none;
        stroke: #ff4d4d;
      }
    }
  }

  // Element colors
  :global([data-button-root].element-styled.wind) {
    background: var(--wind-button-bg);
    color: white;
    &:hover:not(:disabled) { background: var(--wind-button-bg-hover); color: white; }
  }

  :global([data-button-root].element-styled.fire) {
    background: var(--fire-button-bg);
    color: white;
    &:hover:not(:disabled) { background: var(--fire-button-bg-hover); color: white; }
  }

  :global([data-button-root].element-styled.water) {
    background: var(--water-button-bg);
    color: white;
    &:hover:not(:disabled) { background: var(--water-button-bg-hover); color: white; }
  }

  :global([data-button-root].element-styled.earth) {
    background: var(--earth-button-bg);
    color: white;
    &:hover:not(:disabled) { background: var(--earth-button-bg-hover); color: white; }
  }

  :global([data-button-root].element-styled.dark) {
    background: var(--dark-button-bg);
    color: white;
    &:hover:not(:disabled) { background: var(--dark-button-bg-hover); color: white; }
  }

  :global([data-button-root].element-styled.light) {
    background: var(--light-button-bg);
    color: white;
    &:hover:not(:disabled) { background: var(--light-button-bg-hover); color: white; }
  }

  // Element ghost variant
  :global([data-button-root].element-ghost) {
    background-color: transparent;
    &:hover:not(:disabled) {
      background-color: var(--button-bg);
      color: var(--button-text-hover);
    }
  }

  :global([data-button-root].element-ghost.wind) {
    color: var(--wind-ghost-text);
    &:hover:not(:disabled) { background-color: var(--wind-nav-selected-bg); color: var(--wind-nav-selected-text); }
  }

  :global([data-button-root].element-ghost.fire) {
    color: var(--fire-ghost-text);
    &:hover:not(:disabled) { background-color: var(--fire-nav-selected-bg); color: var(--fire-nav-selected-text); }
  }

  :global([data-button-root].element-ghost.water) {
    color: var(--water-ghost-text);
    &:hover:not(:disabled) { background-color: var(--water-nav-selected-bg); color: var(--water-nav-selected-text); }
  }

  :global([data-button-root].element-ghost.earth) {
    color: var(--earth-ghost-text);
    &:hover:not(:disabled) { background-color: var(--earth-nav-selected-bg); color: var(--earth-nav-selected-text); }
  }

  :global([data-button-root].element-ghost.dark) {
    color: var(--dark-ghost-text);
    &:hover:not(:disabled) { background-color: var(--dark-nav-selected-bg); color: var(--dark-nav-selected-text); }
  }

  :global([data-button-root].element-ghost.light) {
    color: var(--light-ghost-text);
    &:hover:not(:disabled) { background-color: var(--light-nav-selected-bg); color: var(--light-nav-selected-text); }
  }
</style>
