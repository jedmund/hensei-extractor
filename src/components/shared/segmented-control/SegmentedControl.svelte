<!-- SegmentedControl Component -->

<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive } from 'bits-ui'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import {
    setSegmentedControlContext,
    type SegmentedControlVariant,
    type SegmentedControlSize
  } from './context'

  interface Props extends HTMLAttributes<HTMLDivElement> {
    value?: string
    onValueChange?: (value: string) => void
    variant?: SegmentedControlVariant
    size?: SegmentedControlSize
    element?: 'wind' | 'fire' | 'water' | 'earth' | 'dark' | 'light' | null
    grow?: boolean
    gap?: boolean
    class?: string
    wrapperClass?: string
    children?: Snippet
  }

  let {
    value = $bindable(),
    onValueChange,
    variant = 'default',
    size = 'default',
    element = null,
    grow = false,
    gap = false,
    class: className,
    wrapperClass,
    children
  }: Props = $props()

  setSegmentedControlContext({
    get variant() {
      return variant
    },
    get size() {
      return size
    },
    get grow() {
      return grow
    },
    get element() {
      return element
    }
  })

  let previousValue = $state<string | undefined>(undefined)

  $effect(() => {
    if (onValueChange && value !== undefined) {
      if (previousValue !== undefined && value !== previousValue) {
        onValueChange(value)
      }
      previousValue = value
    }
  })

  const classList = $derived(
    [
      'sc',
      variant !== 'default' && variant,
      grow && 'sc-grow',
      gap && 'sc-gap',
      className || ''
    ]
      .filter(Boolean)
      .join(' ')
  )

  const wrapperClassList = $derived(
    ['sc-wrapper', grow && 'sc-grow-wrapper', wrapperClass || ''].filter(Boolean).join(' ')
  )
</script>

<div class={wrapperClassList}>
  <RadioGroupPrimitive.Root bind:value class={classList}>
    {@render children?.()}
  </RadioGroupPrimitive.Root>
</div>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/layout' as *;
  @use 'themes/effects' as *;

  :global(.sc-wrapper) {
    display: flex;
  }

  :global(.sc-grow-wrapper) {
    width: 100%;
  }

  :global([data-radio-group-root].sc) {
    display: inline-flex;
    position: relative;
    gap: $unit-half;
    user-select: none;
    overflow: hidden;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  }

  :global([data-radio-group-root].sc.blended) {
    background: var(--segmented-control-blended-bg, var(--color-bg));
    border-radius: $full-corner;
    padding: $unit-half;
  }

  :global([data-radio-group-root].sc.background) {
    background: var(--segmented-control-background-bg, var(--color-bg));
    border-radius: $full-corner;
    padding: $unit-half;
  }

  :global([data-radio-group-root].sc.sc-grow) {
    flex-grow: 1;
    width: 100%;
  }

  :global([data-radio-group-root].sc.sc-gap) {
    gap: $unit-2x;
  }
</style>
