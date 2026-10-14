<!-- DetailRow Component (ported from hensei-svelte): a label on the left and
     its value, or a control, on the right. -->

<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    label?: string
    value?: string | number | null | undefined
    children?: Snippet
    /** Custom label content (e.g. an icon or indicator). Takes precedence over `label`. */
    labelSlot?: Snippet
    /** Remove padding for inline edit contexts */
    noPadding?: boolean
    /** Remove min-width from value (for compact controls like switches) */
    compact?: boolean
  }

  let {
    label,
    value,
    children,
    labelSlot,
    noPadding = false,
    compact = false
  }: Props = $props()
</script>

<div class="detail-row" class:no-padding={noPadding} class:compact class:has-control={children}>
  <span class="label">
    {#if labelSlot}
      {@render labelSlot()}
    {:else}
      {label}
    {/if}
  </span>
  <span class="value">
    {#if children}
      {@render children()}
    {:else}
      {value ?? '—'}
    {/if}
  </span>
</div>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: $unit-2x;
    padding: $unit $unit;

    &.no-padding {
      padding: 0;
    }

    .label {
      flex: 1;
      min-width: 0;
      font-size: $font-small;
      color: var(--color-text-tertiary);
    }

    .value {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-shrink: 0;
      font-size: $font-small;
      color: var(--color-text);
    }

    // Static value display (no children snippet)
    &:not(.has-control) .value {
      font-weight: $medium;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    &.compact .value {
      min-width: unset;
    }
  }
</style>
