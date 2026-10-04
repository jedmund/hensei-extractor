<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
  import { slideRight } from '../../lib/transitions.js'
  import SlideView from '../shared/SlideView.svelte'
  import EmptyState from '../shared/EmptyState.svelte'
  import Icon from '../shared/Icon.svelte'
  import Button from '../shared/Button.svelte'
  import Input from '../shared/Input.svelte'
  import Select from '../shared/Select.svelte'
  import * as m from '../../paraglide/messages.js'
  import { fetchUserPlaylists, createPlaylist } from '../../lib/services/chrome-messages.js'
  import { translateError } from '../../lib/i18n.js'


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
  let loadError = $state('')

  const visibilityOptions = $derived([
    { value: 1, label: m.playlist_public() },
    { value: 2, label: m.playlist_unlisted() },
    { value: 3, label: m.playlist_private() },
  ])

  $effect(() => {
    if (app.playlistPickerOpen) loadPlaylists()
  })

  // Clear the search however the picker closes (Done or Back). Closing only
  // the create form keeps it, since the form may have been prefilled from it.
  $effect(() => {
    if (!app.playlistPickerOpen) searchQuery = ''
  })

  async function loadPlaylists() {
    let error: string | undefined
    try {
      const res = await fetchUserPlaylists()
      error = res.error
      if (!res.error && res.data) {
        playlists = (Array.isArray(res.data) ? res.data : res.data.results ?? []) as Playlist[]
      }
    } catch {
      error = 'request_failed'
    }
    loadError = error ? translateError(error) : ''
  }

  function close() {
    app.playlistPickerOpen = false
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
  }

  // Back closes the create form first, then the picker
  function goBack() {
    if (showCreateForm) hideCreateForm()
    else close()
  }

  let createReady = $derived(!!createTitle.trim() && !creating)

  $effect(() => {
    if (!showCreateForm) {
      createTitle = ''
      createDescription = ''
      createVisibility = 3
      createError = ''
    }
  })

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
      createError = translateError(res.error)
      return
    }

    const newPlaylist = res.data
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
<SlideView
  class="playlist-picker-view"
  id="playlistPickerView"
  title={showCreateForm ? m.playlist_create_title() : m.playlist_select()}
  onBack={goBack}
>
  {#snippet right()}
    {#if showCreateForm}
      <Button size="small" id="playlistCreateSubmitNav" disabled={!createReady} onclick={handleCreate}>{m.action_create()}</Button>
    {:else}
      <Button size="small" id="playlistCreateBtn" onclick={() => showCreateFormWithPrefill()}>{m.playlist_new()}</Button>
    {/if}
  {/snippet}

  <div class="playlist-picker-search">
    <Input type="text" contained id="playlistSearchInput" placeholder={m.playlist_search()} bind:value={searchQuery} />
  </div>

  <div class="playlist-picker-content" id="playlistPickerContent">
    {#if playlists.length === 0 && loadError}
      <EmptyState variant="list" message={loadError} />
    {:else if filteredPlaylists.length === 0 && searchQuery.trim()}
      <button type="button" class="playlist-item playlist-create-prompt" onclick={() => showCreateFormWithPrefill(searchQuery.trim())}>
        <div class="playlist-item-info">
          <span class="playlist-item-title">{m.playlist_create_with({ name: searchQuery.trim() })}</span>
        </div>
      </button>
    {:else if filteredPlaylists.length === 0}
      <EmptyState variant="list" message={m.playlist_no_playlists()} />
    {:else}
      {#each filteredPlaylists as playlist}
        {@const partyCount = playlist.party_count ?? playlist.parties_count ?? 0}
        <button type="button" class="playlist-item" class:selected={isSelected(playlist)} onclick={() => togglePlaylist(playlist)}>
          <div class="playlist-item-info">
            <span class="playlist-item-title">{playlist.title ?? m.playlist_untitled()}</span>
            <span class="playlist-item-count">{partyCount === 1 ? m.count_party({ count: partyCount }) : m.count_parties({ count: partyCount })}</span>
          </div>
          {#if isSelected(playlist)}
            <Icon name="check" size={14} class="playlist-item-check" />
          {/if}
        </button>
      {/each}
    {/if}
  </div>

  <div class="playlist-picker-footer">
    <Button variant="primary" fullWidth id="playlistPickerDone" onclick={close}>{m.action_done()}</Button>
  </div>

  {#if showCreateForm}
    <div class="playlist-create-view" transition:slideRight>
      <div class="playlist-create-form">
        <Input type="text" contained id="playlistCreateTitle" placeholder={m.playlist_title_field()} bind:value={createTitle} />
        <textarea class="contained" id="playlistCreateDescription" rows="3" placeholder={m.playlist_desc_field()} bind:value={createDescription}></textarea>
        <Select options={visibilityOptions} bind:value={createVisibility} contained />
        {#if createError}<p class="playlist-create-error">{createError}</p>{/if}
        <Button variant="primary" fullWidth id="playlistCreateSubmit" disabled={!createTitle.trim() || creating} onclick={handleCreate}>
          {creating ? m.action_creating() : m.action_create()}
        </Button>
      </div>
    </div>
  {/if}
</SlideView>
{/if}
