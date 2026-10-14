<!-- A guide effect's icon (ported from hensei-web): the game's icon from the
     image bucket, or a tile in its category's colour when there isn't one. -->

<script lang="ts">
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import type { GuidebookEntry } from '../../../lib/solomonis/guidebook.js'
  import { iconCategoryLabel } from './labels.js'

  interface Props {
    entry: GuidebookEntry
    size?: 'small' | 'medium'
  }

  let { entry, size = 'medium' }: Props = $props()

  const src = $derived(
    entry.iconType > 0 ? getImageUrl(`${BUCKET.guideEffects}/${entry.iconType}.png`) : null
  )
  // Icons for effects new to the catalogue may not be mirrored yet
  let failedSrc = $state<string | null>(null)
  const label = $derived(iconCategoryLabel(entry.iconCategory))
</script>

{#if src && src !== failedSrc}
  <img
    class="guide-effect-icon {size}"
    {src}
    alt={label}
    loading="lazy"
    onerror={() => (failedSrc = src)}
  />
{:else}
  <span class="guide-effect-icon placeholder {size} {entry.iconCategory}" role="img" aria-label={label}
  ></span>
{/if}

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/layout' as *;

  .guide-effect-icon {
    display: block;
    flex-shrink: 0;
    border-radius: $item-corner-small;

    &.medium {
      width: $unit-5x;
      height: $unit-5x;
    }

    &.small {
      width: $unit-4x;
      height: $unit-4x;
    }
  }

  .placeholder {
    border: 1px solid var(--border-subtle);

    &.offence {
      background: var(--offence-icon-bg);
    }

    &.defence {
      background: var(--defence-icon-bg);
    }

    &.special {
      background: var(--special-icon-bg);
    }

    &.cursed {
      background: var(--cursed-icon-bg);
    }
  }
</style>
