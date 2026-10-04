<!-- SlideView Component: a full-screen view that slides in from the right,
     with a navigation bar and a Back button. Wrap it in the {#if} that opens
     it; the slide plays when that block mounts and unmounts it. -->

<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { slideRight } from '../../lib/transitions.js'
  import NavigationBar from './NavigationBar.svelte'
  import Icon from './Icon.svelte'

  interface Props {
    title?: string | undefined
    subtitle?: string | undefined
    scrolled?: boolean | undefined
    bordered?: boolean | undefined
    onBack?: (() => void) | undefined
    right?: Snippet | undefined
    children?: Snippet | undefined
    class?: string | undefined
    [key: string]: unknown
  }

  const {
    title,
    subtitle,
    scrolled = false,
    bordered = false,
    onBack,
    right: navRight,
    children,
    class: className = '',
    ...restProps
  }: Props = $props()
</script>

<div class={className} {...restProps} transition:slideRight>
  <NavigationBar {title} {subtitle} {scrolled} {bordered}>
    {#snippet left()}
      <button class="detail-back" onclick={onBack}>
        <Icon name="chevron-left" size={14} />
        <span>{m.action_back()}</span>
      </button>
    {/snippet}
    {#snippet right()}
      {#if navRight}{@render navRight()}{/if}
    {/snippet}
  </NavigationBar>

  {#if children}{@render children()}{/if}
</div>
