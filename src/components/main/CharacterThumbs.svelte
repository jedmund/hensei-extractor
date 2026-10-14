<!-- A row of small square character portraits, with a count of any that
     don't fit. -->

<script lang="ts">
  import { BUCKET, getImageUrl } from '../../lib/constants.js'

  interface Props {
    /** Character granblue_ids */
    ids: string[]
    /** How many portraits to show before the "+N" count */
    max?: number
  }

  let { ids, max = 8 }: Props = $props()

  let shown = $derived(ids.slice(0, max))
  let more = $derived(ids.length - shown.length)
</script>

<span class="character-thumbs">
  {#each shown as id (id)}
    <img src={getImageUrl(`${BUCKET.characterSquare}/${id}_01.jpg`)} alt="" loading="lazy" />
  {/each}
  {#if more > 0}
    <span class="more">+{more}</span>
  {/if}
</span>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;

  .character-thumbs {
    display: flex;
    align-items: center;
    gap: $unit-half;
    margin-top: $unit-half;

    img {
      width: $unit-3x;
      height: $unit-3x;
      border-radius: $item-corner-small;
      object-fit: cover;
    }
  }

  .more {
    font-size: $font-tiny;
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
  }
</style>
