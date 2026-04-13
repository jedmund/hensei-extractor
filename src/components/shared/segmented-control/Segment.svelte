<!-- Segment Component -->

<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive } from 'bits-ui'
  import type { Snippet } from 'svelte'
  import { getSegmentedControlContext } from './context'

  interface Props {
    value: string
    class?: string
    disabled?: boolean
    children?: Snippet
  }

  let { value, class: className, disabled, children: content }: Props = $props()

  const ctx = getSegmentedControlContext()
  const { variant, size, grow } = ctx

  const segmentClass = $derived(
    [
      'segment',
      variant,
      size !== 'default' && size,
      ctx.element || '',
      grow && 'segment-grow',
      className || ''
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

<RadioGroupPrimitive.Item
  {value}
  {...disabled !== undefined ? { disabled } : {}}
  class={segmentClass}
>
  {#snippet children({ checked })}
    {#if checked}
      <div class="segment-indicator"></div>
    {/if}
    <span class="segment-label">{@render content?.()}</span>
  {/snippet}
</RadioGroupPrimitive.Item>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;
  @use 'themes/effects' as *;

  :global([data-radio-group-item].segment) {
    color: var(--color-text-secondary);
    cursor: pointer;
    flex-grow: 1;
    font-size: $font-regular;
    font-weight: $normal;
    min-width: 100px;
    position: relative;
    background: transparent;
    border: none;
    padding: 0;
    text-align: center;
    outline: none;

    &:focus-visible .segment-label {
      outline: 2px solid #275dc5;
      outline-offset: 2px;
    }
  }

  // Small size
  :global([data-radio-group-item].segment.small) {
    font-size: $font-small;
    min-width: 80px;

    .segment-label {
      padding: $unit $unit-2x;
    }
  }

  // Extra small size
  :global([data-radio-group-item].segment.xsmall) {
    font-size: $font-small;
    min-width: 60px;

    .segment-label {
      padding: $unit-half $unit;
    }
  }

  // Grow
  :global([data-radio-group-item].segment.segment-grow) {
    flex: 1;
    min-width: 0;
  }

  // Label
  :global([data-radio-group-item].segment .segment-label) {
    border: 0.5px solid transparent;
    border-radius: $full-corner;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    box-sizing: border-box;
    font-weight: $medium;
    height: 100%;
    white-space: nowrap;
    overflow: hidden;
    padding: calc($unit * 1.5) $unit-2x;
    text-overflow: ellipsis;
    cursor: pointer;
    @include smooth-transition($duration-quick, all);
  }

  // Indicator (hidden)
  :global([data-radio-group-item].segment .segment-indicator) {
    display: none;
  }

  // Default variant
  :global([data-radio-group-item].segment.default .segment-label) {
    background: transparent;
    color: var(--color-text-secondary);
  }

  :global([data-radio-group-item].segment.default:hover .segment-label) {
    background: var(--color-bg);
    color: var(--color-text);
  }

  :global([data-radio-group-item].segment.default[data-state='checked'] .segment-label) {
    background: white;
    color: var(--color-text);
  }

  // Blended variant
  :global([data-radio-group-item].segment.blended .segment-label) {
    color: var(--segmented-control-blended-segment-text, var(--color-text-secondary));
  }

  :global([data-radio-group-item].segment.blended:hover .segment-label) {
    background: var(--segmented-control-blended-segment-bg-hover, var(--color-bg));
    color: var(--segmented-control-blended-segment-text-hover, var(--color-text));
  }

  :global([data-radio-group-item].segment.blended[data-state='checked'] .segment-label) {
    background: var(--segmented-control-blended-segment-bg-checked, white);
    color: var(--segmented-control-blended-segment-text-checked, var(--color-text));
  }

  // Background variant
  :global([data-radio-group-item].segment.background .segment-label) {
    background: var(--segmented-control-background-segment-bg, transparent);
    color: var(--segmented-control-background-segment-text, var(--color-text-secondary));
  }

  :global([data-radio-group-item].segment.background:hover .segment-label) {
    background: var(--segmented-control-background-segment-bg-hover, var(--color-bg));
    color: var(--segmented-control-background-segment-text-hover, var(--color-text));
  }

  :global([data-radio-group-item].segment.background[data-state='checked'] .segment-label) {
    background: var(--segmented-control-background-segment-bg-checked, white);
    color: var(--segmented-control-background-segment-text-checked, var(--color-text));
    border: 0.5px solid rgba(0, 0, 0, 0.12);
    box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.06));
  }

  // Element-specific styles
  :global([data-radio-group-item].segment.fire[data-state='checked'] .segment-label) {
    background: var(--fire-nav-selected-bg);
    color: var(--fire-nav-selected-text);
  }

  :global([data-radio-group-item].segment.fire:hover:not([data-state='checked']) .segment-label) {
    background: var(--fire-nav-selected-bg);
    color: var(--fire-nav-selected-text);
    opacity: 0.7;
  }

  :global([data-radio-group-item].segment.water[data-state='checked'] .segment-label) {
    background: var(--water-nav-selected-bg);
    color: var(--water-nav-selected-text);
  }

  :global([data-radio-group-item].segment.water:hover:not([data-state='checked']) .segment-label) {
    background: var(--water-nav-selected-bg);
    color: var(--water-nav-selected-text);
    opacity: 0.7;
  }

  :global([data-radio-group-item].segment.earth[data-state='checked'] .segment-label) {
    background: var(--earth-nav-selected-bg);
    color: var(--earth-nav-selected-text);
  }

  :global([data-radio-group-item].segment.earth:hover:not([data-state='checked']) .segment-label) {
    background: var(--earth-nav-selected-bg);
    color: var(--earth-nav-selected-text);
    opacity: 0.7;
  }

  :global([data-radio-group-item].segment.wind[data-state='checked'] .segment-label) {
    background: var(--wind-nav-selected-bg);
    color: var(--wind-nav-selected-text);
  }

  :global([data-radio-group-item].segment.wind:hover:not([data-state='checked']) .segment-label) {
    background: var(--wind-nav-selected-bg);
    color: var(--wind-nav-selected-text);
    opacity: 0.7;
  }

  :global([data-radio-group-item].segment.light[data-state='checked'] .segment-label) {
    background: var(--light-nav-selected-bg);
    color: var(--light-nav-selected-text);
  }

  :global([data-radio-group-item].segment.light:hover:not([data-state='checked']) .segment-label) {
    background: var(--light-nav-selected-bg);
    color: var(--light-nav-selected-text);
    opacity: 0.7;
  }

  :global([data-radio-group-item].segment.dark[data-state='checked'] .segment-label) {
    background: var(--dark-nav-selected-bg);
    color: var(--dark-nav-selected-text);
  }

  :global([data-radio-group-item].segment.dark:hover:not([data-state='checked']) .segment-label) {
    background: var(--dark-nav-selected-bg);
    color: var(--dark-nav-selected-text);
    opacity: 0.7;
  }
</style>
