<!--
  A labeled on/off row for the profile menu, with a short label or icon
  drawn on each side of the track. The language and theme toggles use it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Switch as SwitchPrimitive } from 'bits-ui'

  interface Props {
    label: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    /** Shown on the left of the track, uncovered when checked */
    left: Snippet
    /** Shown on the right of the track, uncovered when unchecked */
    right: Snippet
    /** Track colors; the default is grey either way */
    trackColor?: string
    checkedTrackColor?: string
  }

  let {
    label,
    checked,
    onCheckedChange,
    left,
    right,
    trackColor = '#a9a9a9',
    checkedTrackColor = trackColor
  }: Props = $props()
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="menu-switch-row"
  onpointerdown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <span class="menu-switch-label">{label}</span>
  <SwitchPrimitive.Root
    {checked}
    {onCheckedChange}
    aria-label={label}
    class="menu-switch"
    style="--track: {trackColor}; --track-checked: {checkedTrackColor}"
  >
    <SwitchPrimitive.Thumb class="menu-switch-thumb" />
    <span class="track-label left">{@render left()}</span>
    <span class="track-label right">{@render right()}</span>
  </SwitchPrimitive.Root>
</div>

<style lang="scss">
  @use 'themes/typography' as typography;
  @use 'themes/spacing' as spacing;
  @use 'themes/effects' as effects;

  .menu-switch-row {
    display: flex;
    align-items: center;
    gap: spacing.$unit;
    padding: spacing.$unit calc(spacing.$unit * 1.5);
    width: 100%;
  }

  .menu-switch-label {
    flex: 1;
    font-size: typography.$font-small;
    font-weight: typography.$medium;
    color: var(--color-text);
    user-select: none;
  }

  :global(.menu-switch) {
    $height: 24px;

    background: var(--track);
    border-radius: calc($height / 2);
    border: none;
    position: relative;
    width: 44px;
    height: $height;
    cursor: pointer;
    flex-shrink: 0;
    @include effects.smooth-transition(
      effects.$duration-instant,
      background-color
    );
  }

  :global(.menu-switch[data-state='checked']) {
    background: var(--track-checked);
  }

  :global(.menu-switch-thumb) {
    $diameter: 18px;

    background: white;
    border-radius: calc($diameter / 2);
    display: block;
    height: $diameter;
    width: $diameter;
    position: absolute;
    top: 3px;
    left: 3px;
    z-index: 3;
    cursor: pointer;
    @include effects.smooth-transition(effects.$duration-instant, left);
  }

  :global(.menu-switch-thumb[data-state='checked']) {
    left: 23px;
  }

  .track-label {
    color: white;
    font-size: typography.$font-micro;
    font-weight: typography.$bold;
    position: absolute;
    top: 6px;
    z-index: 2;
    display: flex;
    align-items: center;
    user-select: none;
    pointer-events: none;

    :global(svg) {
      width: 12px;
      height: 12px;
    }

    &.left {
      left: 6px;
    }

    &.right {
      right: 5px;
    }
  }
</style>
