<!-- CharacterTags Component (ported from hensei-svelte): a character's
     style, season and series tags. Standard and season-duplicate series are
     left out, and Summer is hidden for Yukata characters. -->

<script lang="ts">
  import type { CharacterTagData } from '../../../lib/types/messages.js'
  import CharacterTag from './CharacterTag.svelte'

  interface Props {
    character: CharacterTagData
  }

  let { character }: Props = $props()

  const SEASON_NAMES: Record<number, string> = {
    1: 'Valentine',
    2: 'Formal',
    3: 'Summer',
    4: 'Halloween',
    5: 'Holiday'
  }

  const seasonText = $derived(
    character.season != null && character.season > 0
      ? (SEASON_NAMES[character.season] ?? null)
      : null
  )

  const displayableSeriesIndices = $derived(
    character.series.flatMap((entry, index) =>
      entry.name.en === 'Standard' || entry.name.en === seasonText ? [] : [index]
    )
  )

  // Yukata is more specific than Summer, so Summer's season tag is hidden
  const isYukataWithSummer = $derived(
    seasonText === 'Summer' && character.series.some((entry) => entry.name.en === 'Yukata')
  )
  const hasSeason = $derived(seasonText !== null && !isYukataWithSummer)
  const hasTags = $derived(hasSeason || displayableSeriesIndices.length > 0 || character.styleSwap)
</script>

{#if hasTags}
  <div class="tags">
    {#if character.styleSwap}
      <CharacterTag {character} type="style" />
    {/if}
    {#if hasSeason}
      <CharacterTag {character} type="season" />
    {/if}
    {#each displayableSeriesIndices as seriesIndex (seriesIndex)}
      <CharacterTag {character} type="series" {seriesIndex} />
    {/each}
  </div>
{/if}

<style lang="scss">
  @use 'themes/spacing' as *;

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: $unit-half;
  }
</style>
