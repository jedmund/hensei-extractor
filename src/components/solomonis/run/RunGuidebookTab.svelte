<!-- The guidebook log: the run's effects by rarity, each with its stacks. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import {
    guidebookSections,
    type GuidebookRarity
  } from '../../../lib/solomonis/guidebook.js'
  import type { SolomonisStatus } from '../../../lib/solomonis/types.js'

  interface Props {
    statusList: SolomonisStatus[]
  }

  let { statusList }: Props = $props()

  let sections = $derived(guidebookSections(statusList))

  const labels: Record<GuidebookRarity, () => string> = {
    unique: m.solomonis_extension_rarity_unique,
    rare: m.solomonis_extension_rarity_rare,
    normal: m.solomonis_extension_rarity_normal,
    cursed: m.solomonis_extension_rarity_cursed
  }
</script>

{#if sections.length === 0}
  <p class="empty">{m.solomonis_extension_guidebook_empty()}</p>
{:else}
  <div class="guidebook">
    {#each sections as section (section.rarity)}
      <section class="rarity">
        <h3 class="section-label">
          {labels[section.rarity]()}
          <span class="section-count">{section.stacks}</span>
        </h3>
        <ul class="effects">
          {#each section.entries as entry, index (`${entry.statusId}-${index}`)}
            <li class="effect">
              <span class="effect-name">{entry.name}</span>
              {#if entry.count > 1}
                <span class="effect-count">×{entry.count}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<style lang="scss">
  @use 'themes/layout' as *;
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .guidebook {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
  }

  .rarity {
    display: flex;
    flex-direction: column;
    gap: $unit-half;
  }

  .section-label {
    display: flex;
    align-items: baseline;
    gap: $unit;
    margin: 0;
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
  }

  .section-count {
    font-weight: $normal;
    color: var(--color-text-secondary);
  }

  .effects {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .effect {
    display: flex;
    align-items: baseline;
    gap: $unit;
    padding: $unit-half 0;
    border-bottom: 1px solid var(--color-border-light);
    font-size: $font-small;
    color: var(--color-text);

    &:last-child {
      border-bottom: none;
    }
  }

  .effect-name {
    flex: 1;
    min-width: 0;
  }

  .effect-count {
    flex-shrink: 0;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .empty {
    margin: 0;
    font-size: $font-small;
    color: var(--color-text-secondary);
  }
</style>
