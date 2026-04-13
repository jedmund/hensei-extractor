<script lang="ts">
  import { Tooltip as TooltipBase } from 'bits-ui'
  import type { Snippet } from 'svelte'

  interface Props {
    content: string
    children: Snippet
    delayDuration?: number
    disableCloseOnTriggerClick?: boolean
    disabled?: boolean
    disableHoverableContent?: boolean
  }

  const {
    content,
    children,
    delayDuration = 200,
    disableCloseOnTriggerClick = false,
    disabled = false,
    disableHoverableContent = false
  }: Props = $props()
</script>

<TooltipBase.Root {delayDuration} {disableCloseOnTriggerClick} {disabled} {disableHoverableContent}>
  <TooltipBase.Trigger>
    {#snippet child({ props })}
      <span {...props}>
        {@render children()}
      </span>
    {/snippet}
  </TooltipBase.Trigger>
  <TooltipBase.Portal>
    <TooltipBase.Content class="tooltip-content" sideOffset={8}>
      {content}
    </TooltipBase.Content>
  </TooltipBase.Portal>
</TooltipBase.Root>

<style lang="scss">
  @use 'themes/layout' as *;
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;
  @use 'themes/effects' as effects;

  :global(.tooltip-content) {
    background: var(--tooltip-bg, #2a2a2a);
    color: var(--tooltip-text, white);
    padding: $unit-half $unit;
    border-radius: $item-corner-small;
    font-size: $font-small;
    font-weight: $medium;
    z-index: effects.$z-notification;
    box-shadow: var(--shadow-md);
    max-width: calc($unit * 31.25);
    line-height: 1.4;
    text-align: center;
  }
</style>
