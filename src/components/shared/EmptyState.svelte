<!-- EmptyState Component: the message shown when a panel or list has nothing
     to show, or failed to load.

     - panel: fills its panel, centred, with optional action buttons below.
       Uses the global .cache-empty styles in _cache.scss.
     - list: a short italic line at the top of a picker list. -->

<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    message: string
    variant?: 'panel' | 'list' | undefined
    actions?: Snippet | undefined
    class?: string | undefined
    [key: string]: unknown
  }

  const { message, variant = 'panel', actions, class: className = '', ...restProps }: Props = $props()
</script>

{#if variant === 'panel'}
  <div class="cache-empty {className}" {...restProps}>
    <p>{message}</p>
    {#if actions}
      <div class="cache-empty-actions">{@render actions()}</div>
    {/if}
  </div>
{:else}
  <div class="empty-state-list {className}" {...restProps}>{message}</div>
{/if}

<style lang="scss">
  @use 'themes/spacing' as spacing;
  @use 'themes/typography' as type;

  .empty-state-list {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: spacing.$unit-4x;
    color: var(--color-text-secondary);
    font-size: type.$font-small;
    font-style: italic;
  }
</style>
