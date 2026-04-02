<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
  import * as m from '../../paraglide/messages.js'
  import { fetchUserPlaylists, createPlaylist } from '../../lib/services/chrome-messages.js'

  interface Playlist {
    id: string | number
    title?: string
    description?: string
    party_count?: number
    parties_count?: number
    visibility?: number
  }

  let playlists = $state<Playlist[]>([])
  let searchQuery = $state('')
  let showCreateForm = $state(false)
  let createTitle = $state('')
  let createDescription = $state('')
  let createVisibility = $state(3)
  let creating = $state(false)
  let createError = $state('')
  let dropdownOpen = $state(false)

  const VISIBILITY_LABELS: Record<number, () => string> = {
    1: () => m.playlist_public(),
    2: () => m.playlist_unlisted(),
    3: () => m.playlist_private(),
  }

  $effect(() => {
    if (app.playlistPickerOpen) loadPlaylists()
  })

  async function loadPlaylists() {
    const res = await fetchUserPlaylists()
    if (!res.error) playlists = res.data?.results ?? res.data ?? []
  }

  function close() {
    app.playlistPickerOpen = false
    searchQuery = ''
    hideCreateForm()
  }

  function isSelected(playlist: Playlist): boolean {
    return app.selectedPlaylists.some((p) => String(p.id) === String(playlist.id))
  }

  function togglePlaylist(playlist: Playlist) {
    const idx = app.selectedPlaylists.findIndex((p) => String(p.id) === String(playlist.id))
    if (idx >= 0) {
      app.selectedPlaylists = app.selectedPlaylists.filter((_, i) => i !== idx)
    } else {
      app.selectedPlaylists = [...app.selectedPlaylists, { id: String(playlist.id), title: playlist.title ?? '' }]
    }
  }

  let filteredPlaylists = $derived.by(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return playlists
    return playlists.filter((p) => {
      return (p.title ?? '').toLowerCase().includes(query) || (p.description ?? '').toLowerCase().includes(query)
    })
  })

  function showCreateFormWithPrefill(prefill?: string) {
    showCreateForm = true
    if (prefill) createTitle = prefill
  }

  function hideCreateForm() {
    showCreateForm = false
    createTitle = ''
    createDescription = ''
    createVisibility = 3
    createError = ''
    dropdownOpen = false
  }

  async function handleCreate() {
    if (!createTitle.trim()) {
      createError = m.playlist_title_required()
      return
    }
    creating = true
    createError = ''

    const res = await createPlaylist({
      title: createTitle.trim(),
      description: createDescription.trim(),
      visibility: createVisibility,
    })

    creating = false

    if (res.error) {
      createError = res.error
      return
    }

    const newPlaylist = res.data?.playlist ?? res.data
    if (newPlaylist) {
      if (!newPlaylist.title) newPlaylist.title = createTitle.trim()
      app.selectedPlaylists = [...app.selectedPlaylists, { id: String(newPlaylist.id), title: newPlaylist.title }]
    }

    await loadPlaylists()
    searchQuery = ''
    hideCreateForm()
  }
</script>

{#if app.playlistPickerOpen}
<div class="picker-view playlist-picker-view active">
  <header class="picker-header">
    <button type="button" class="picker-back" onclick={close}>{m.action_back()}</button>
    <h2 class="picker-title">{m.playlist_select()}</h2>
    <button type="button" class="picker-action" onclick={close}>{m.action_done()}</button>
  </header>

  <div class="picker-search">
    <input type="text" class="playlist-search-input" placeholder={m.playlist_search()} bind:value={searchQuery} />
  </div>

  <div class="picker-content playlist-picker-content">
    {#if !showCreateForm}
      <button type="button" class="playlist-item playlist-create-btn" onclick={() => showCreateFormWithPrefill()}>
        <div class="playlist-item-info">
          <span class="playlist-item-title">{m.playlist_new()}</span>
        </div>
      </button>
    {/if}

    {#if showCreateForm}
      <div class="playlist-create-form">
        <div class="playlist-create-fields">
          <input type="text" class="playlist-create-title" placeholder={m.playlist_title_field()} bind:value={createTitle} />
          <input type="text" class="playlist-create-description" placeholder={m.playlist_desc_field()} bind:value={createDescription} />
          <div class="playlist-visibility">
            <button type="button" class="playlist-visibility-button" onclick={(e: MouseEvent) => { e.stopPropagation(); dropdownOpen = !dropdownOpen }}>
              {VISIBILITY_LABELS[createVisibility]?.() ?? m.playlist_private()}
            </button>
            {#if dropdownOpen}
              <div class="playlist-visibility-dropdown">
                {#each [1, 2, 3] as val}
                  <button
                    type="button"
                    class="visibility-option"
                    class:selected={createVisibility === val}
                    onclick={() => { createVisibility = val; dropdownOpen = false }}
                  >{VISIBILITY_LABELS[val]?.() ?? ''}</button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        {#if createError}<p class="playlist-create-error">{createError}</p>{/if}
        <div class="playlist-create-actions">
          <button type="button" class="playlist-create-back" onclick={hideCreateForm}>{m.action_cancel()}</button>
          <button type="button" class="playlist-create-submit" disabled={!createTitle.trim() || creating} onclick={handleCreate}>
            {creating ? m.action_creating() : m.action_create()}
          </button>
        </div>
      </div>
    {/if}

    {#if filteredPlaylists.length === 0 && searchQuery.trim()}
      <button type="button" class="playlist-item playlist-create-prompt" onclick={() => showCreateFormWithPrefill(searchQuery.trim())}>
        <div class="playlist-item-info">
          <span class="playlist-item-title">{m.playlist_create_with({ name: searchQuery.trim() })}</span>
        </div>
      </button>
    {:else if filteredPlaylists.length === 0}
      <div class="playlist-empty">{m.playlist_no_playlists()}</div>
    {:else}
      {#each filteredPlaylists as playlist}
        {@const partyCount = playlist.party_count ?? playlist.parties_count ?? 0}
        <button type="button" class="playlist-item" class:selected={isSelected(playlist)} onclick={() => togglePlaylist(playlist)}>
          <div class="playlist-item-info">
            <span class="playlist-item-title">{playlist.title ?? m.playlist_untitled()}</span>
            <span class="playlist-item-count">{partyCount === 1 ? m.count_party({ count: partyCount }) : m.count_parties({ count: partyCount })}</span>
          </div>
          {#if isSelected(playlist)}
            <svg class="playlist-item-check" viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M11.53 3.47a.75.75 0 0 1 .073.976l-.073.084-5.5 5.5a.75.75 0 0 1-.976.073l-.084-.073-2.5-2.5a.75.75 0 0 1 .976-1.133l.084.073L5.5 8.44l4.97-4.97a.75.75 0 0 1 1.06 0z"/></svg>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</div>
{/if}
