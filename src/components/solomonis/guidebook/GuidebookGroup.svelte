<!-- One rarity's guidebook effects, a collapsible section of the guidebook
     accordion (ported from hensei-web's GuidebookGroup). -->

<script lang="ts">
  import { Accordion } from 'bits-ui'
  import type { GuidebookSection } from '../../../lib/solomonis/guidebook.js'
  import Icon from '../../shared/Icon.svelte'
  import GuidebookRow from './GuidebookRow.svelte'
  import { rarityLabel } from './labels.js'

  interface Props {
    group: GuidebookSection
  }

  let { group }: Props = $props()
</script>

<Accordion.Item value={group.rarity} class="guidebook-group {group.rarity}">
  <Accordion.Header level={4} class="group-header">
    <Accordion.Trigger class="group-trigger">
      <span class="group-title">{rarityLabel(group.rarity)}</span>
      <span class="group-count">{group.entries.length}</span>
      <Icon name="chevron-down-small" size={14} class="group-chevron" />
    </Accordion.Trigger>
  </Accordion.Header>
  <Accordion.Content class="group-content">
    <ul class="effects">
      {#each group.entries as entry, index (`${entry.statusId}-${index}`)}
        <li>
          <GuidebookRow {entry} />
        </li>
      {/each}
    </ul>
  </Accordion.Content>
</Accordion.Item>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;

  :global(.guidebook-group .group-header) {
    margin: 0;
  }

  // Full-width header; a rounded grey rect on hover
  :global(.guidebook-group .group-trigger) {
    display: flex;
    align-items: center;
    gap: $unit;
    padding: $unit;
    margin: 0 (-$unit);
    width: calc(100% + #{$unit-2x});
    border: none;
    border-radius: $item-corner;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background: var(--list-cell-bg-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--color-link);
      outline-offset: 1px;
    }
  }

  .group-title {
    font-size: $font-small;
    font-weight: $bold;
    color: var(--color-text-tertiary);
  }

  .group-count {
    flex: 1;
    font-size: $font-small;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  :global(.guidebook-group .group-chevron) {
    color: var(--icon-secondary);
    transition: transform 0.15s ease;
  }

  :global(.guidebook-group .group-trigger[data-state='closed'] .group-chevron) {
    transform: rotate(-90deg);
  }

  :global(.guidebook-group.cursed) .group-title {
    color: var(--danger);
  }

  :global(.guidebook-group .group-content) {
    padding-top: $unit-half;
  }

  .effects {
    display: flex;
    flex-direction: column;
    gap: $unit;
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
