<!-- The guidebook log: the run's effects by rarity, laid out with
     hensei-web's guidebook components. -->

<script lang="ts">
  import { Accordion } from 'bits-ui'
  import * as m from '../../../paraglide/messages.js'
  import { guidebookSections, RARITY_ORDER } from '../../../lib/solomonis/guidebook.js'
  import type { SolomonisStatus } from '../../../lib/solomonis/types.js'
  import GuidebookGroup from '../guidebook/GuidebookGroup.svelte'

  interface Props {
    statusList: SolomonisStatus[]
  }

  let { statusList }: Props = $props()

  let sections = $derived(guidebookSections(statusList))
  // Every rarity open to start; each header collapses its section
  let openGroups = $state<string[]>([...RARITY_ORDER])
</script>

{#if sections.length === 0}
  <p class="empty">{m.solomonis_extension_guidebook_empty()}</p>
{:else}
  <Accordion.Root type="multiple" bind:value={openGroups} class="guidebook">
    {#each sections as group (group.rarity)}
      <GuidebookGroup {group} />
    {/each}
  </Accordion.Root>
{/if}

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;

  :global(.guidebook) {
    display: flex;
    flex-direction: column;
    gap: $unit;
  }

  .empty {
    margin: 0;
    font-size: $font-small;
    color: var(--color-text-secondary);
  }
</style>
