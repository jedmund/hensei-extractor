<!-- One expedition stat: an optional space icon, its name and its count.
     Matches hensei-web's TraversalRow. -->

<script lang="ts">
  interface Props {
    label: string
    count: number
    /** The space's icon, when it has one */
    icon?: string | undefined
  }

  let { label, count, icon }: Props = $props()
</script>

<div class="stat-row">
  {#if icon}
    <img src={icon} alt="" class="icon" />
  {/if}
  <span class="label">{label}</span>
  <span class="count">{count.toLocaleString()}</span>
</div>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;

  .stat-row {
    display: flex;
    align-items: center;
    gap: $unit;
    min-height: $unit-3x;
  }

  .icon {
    width: $unit-3x;
    height: $unit-3x;
    object-fit: contain;
    flex-shrink: 0;
  }

  .label {
    flex: 1;
    min-width: 0;
    font-size: $font-small;
    color: var(--color-text-tertiary);
  }

  .count {
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }
</style>
