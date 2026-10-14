<!-- DetailsSection Component (ported from hensei-svelte): a titled group of
     detail rows, with an optional action beside the title. -->

<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    /** Extra text after the title in the secondary colour, e.g. a count or total */
    titleSuffix?: string | undefined
    children: Snippet
    /** Optional action rendered at the right side of the section header */
    action?: Snippet | undefined
    /** Optional description rendered below children inside the same section */
    description?: Snippet | undefined
    /** Message to show when section has no content */
    emptyMessage?: string | undefined
    /** Whether the section is empty (shows emptyMessage instead of children) */
    empty?: boolean
  }

  let {
    title,
    titleSuffix,
    children,
    action,
    description,
    emptyMessage,
    empty = false
  }: Props = $props()
</script>

<div class="details-section">
  <div class="header">
    <h3>
      {title}
      {#if titleSuffix}
        <span class="title-suffix">{titleSuffix}</span>
      {/if}
    </h3>
    {#if action}
      {@render action()}
    {/if}
  </div>
  {#if empty && emptyMessage}
    <p class="empty-message">{emptyMessage}</p>
  {:else}
    {@render children()}
    {#if description}
      <div class="description">
        {@render description()}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;

  .details-section {
    display: flex;
    flex-direction: column;
    gap: $unit-half;

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 $unit;
    }

    h3 {
      margin: 0;
      font-size: $font-small;
      font-weight: $medium;
      color: var(--color-text);
    }

    .title-suffix {
      color: var(--color-text-secondary);
    }

    .empty-message {
      margin: 0;
      padding: $unit-4x $unit;
      text-align: center;
      font-size: $font-small;
      color: var(--color-text-secondary);
    }

    .description {
      padding: 0 $unit;
    }
  }
</style>
