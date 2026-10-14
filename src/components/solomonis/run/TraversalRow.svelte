<!-- One kind of space in TraversalSection: its icon, name and how many times
     the expedition reached it. Matches hensei-web's TraversalRow. -->

<script lang="ts">
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import type { SpaceStatKey } from '../../../lib/solomonis/report-stats.js'

  interface Props {
    space: SpaceStatKey
    label: string
    count: number
  }

  let { space, label, count }: Props = $props()
</script>

<div class="traversal-row">
  <img src={getImageUrl(`${BUCKET.solomonisSpaces}/${space}.png`)} alt="" class="icon" />
  <span class="label">{label}</span>
  <span class="count">{count}</span>
</div>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;

  .traversal-row {
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
