<!-- One guidebook effect (ported from hensei-web's GuidebookRow): its icon,
     the game's text and its stacks. Read-only in the extension. -->

<script lang="ts">
  import type { GuidebookEntry } from '../../../lib/solomonis/guidebook.js'
  import GuideEffectIcon from './GuideEffectIcon.svelte'

  interface Props {
    entry: GuidebookEntry
  }

  let { entry }: Props = $props()
</script>

<div class="guide-effect-item {entry.rarity}">
  <GuideEffectIcon {entry} />
  <span class="text">
    <span class="name">{entry.name}</span>
  </span>
  {#if entry.count > 1 || entry.stackable}
    <span class="count">×{entry.count}</span>
  {/if}
</div>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;

  .guide-effect-item {
    display: flex;
    align-items: center;
    gap: $unit;
    width: 100%;
    min-height: $unit-6x;
    padding: $unit $unit-2x $unit $unit;
    box-sizing: border-box;
    border-radius: $card-corner;
    // A light wash instead of a border; cursed effects are tinted red
    background: var(--guide-effect-row-bg);
    color: var(--color-text);

    &.cursed {
      background: color-mix(in srgb, var(--danger) 12%, var(--guide-effect-row-bg));
    }
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $unit-half;
    min-width: 0;
  }

  .name {
    font-size: $font-small;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .count {
    flex-shrink: 0;
    font-size: $font-small;
    font-weight: $bold;
    color: var(--color-text-tertiary);
  }
</style>
