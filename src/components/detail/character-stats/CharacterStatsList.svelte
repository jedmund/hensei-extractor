<!-- The captured character stats, one card per character, most recent first.
     Every character starts selected for import. -->

<script lang="ts">
  import { untrack } from 'svelte'
  import { app } from '../../../lib/state/app.svelte.js'
  import { fetchCharacterTags } from '../../../lib/services/chrome-messages.js'
  import type { CharacterTagData } from '../../../lib/types/messages.js'
  import * as m from '../../../paraglide/messages.js'
  import EmptyState from '../../shared/EmptyState.svelte'
  import CharacterStatsCard, { type CharacterStatsEntry } from './CharacterStatsCard.svelte'

  interface Props {
    data: Record<string, CharacterStatsEntry>
  }

  let { data }: Props = $props()

  let characters = $derived(
    Object.values(data).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  )

  // Initialize all items as selected
  $effect(() => {
    if (characters.length > 0 && app.selectedItems.size === 0) {
      app.selectedItems = new Set(characters.map((_, i) => i))
    }
  })

  function toggleItem(index: number, e: MouseEvent) {
    e.stopPropagation()
    const next = new Set(app.selectedItems)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    app.selectedItems = next
  }

  // Season, series and style tags come from hensei-api, looked up again
  // only when the set of characters changes. `characters` is rebuilt on
  // every refresh, so the effect keys on the sorted ids instead.
  let tags = $state<Record<string, CharacterTagData | null>>({})
  let tagIdsKey = $derived(
    [...new Set(characters.map((c) => c.masterId).filter((id): id is string => !!id))]
      .sort()
      .join(',')
  )
  let tagsSeq = 0
  $effect(() => {
    const key = tagIdsKey
    untrack(() => {
      const seq = ++tagsSeq
      const ids = key ? key.split(',') : []
      void fetchCharacterTags(ids).then((result) => {
        // An older lookup that finishes late doesn't overwrite a newer one
        if (seq === tagsSeq) tags = result
      })
    })
  })
</script>

{#if characters.length === 0}
  <EmptyState message={m.char_stats_no_captured()} />
{:else}
  <div class="char-stats-list">
    {#each characters as character, index (character.masterId)}
      <CharacterStatsCard
        {character}
        tags={character.masterId ? (tags[character.masterId] ?? null) : null}
        selected={app.selectedItems.has(index)}
        onToggle={(e) => toggleItem(index, e)}
      />
    {/each}
  </div>
{/if}
