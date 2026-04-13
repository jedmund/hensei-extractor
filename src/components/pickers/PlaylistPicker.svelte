<script lang="ts">
  import type { Snippet } from 'svelte'
  import { app } from '../../lib/state/app.svelte.js'
  import { slideRight } from '../../lib/transitions.js'
  import NavigationBar from '../shared/NavigationBar.svelte'
  import Icon from '../shared/Icon.svelte'
  import Button from '../shared/Button.svelte'
  import Input from '../shared/Input.svelte'
  import Select from '../shared/Select.svelte'
  import * as m from '../../paraglide/messages.js'
  import { fetchUserPlaylists, createPlaylist } from '../../lib/services/chrome-messages.js'
  import { translateError } from '../../lib/i18n.js'

  interface Props {
    title?: string
    onBack?: () => void
    navRight?: Snippet
  }

  let { title = '', onBack, navRight }: Props = $props()

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
  let showCreateForm = $derived(app.playlistCreateFormOpen)
  let createTitle = $state('')
  let createDescription = $state('')
  let createVisibility = $state(3)
  let creating = $state(false)
  let createError = $state('')

  const visibilityOptions = $derived([
    { value: 1, label: m.playlist_public() },
    { value: 2, label: m.playlist_unlisted() },
    { value: 3, label: m.playlist_private() },
  ])

  $effect(() => {
    if (app.playlistPickerOpen) loadPlaylists()
  })

  async function loadPlaylists() {
    const res = await fetchUserPlaylists()
    if (!res.error && res.data) {
      playlists = (Array.isArray(res.data) ? res.data : res.data.results ?? []) as Playlist[]
    }
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
    app.playlistCreateFormOpen = true
    if (prefill) createTitle = prefill
  }

  function hideCreateForm() {
    app.playlistCreateFormOpen = false
  }

  $effect(() => {
    app.playlistCreateReady = !!createTitle.trim() && !creating
  })

  $effect(() => {
    if (!app.playlistCreateFormOpen) {
      createTitle = ''
      createDescription = ''
      createVisibility = 3
      createError = ''
    }
  })

  $effect(() => {
    if (app.playlistCreateSubmit) {
      app.playlistCreateSubmit = false
      handleCreate()
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
<div class="playlist-picker-view" id="playlistPickerView" transition:slideRight>
  <NavigationBar {title}>
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

  <div class="playlist-picker-search">
    <Input type="text" contained id="playlistSearchInput" placeholder={m.playlist_search()} bind:value={searchQuery} />
  </div>

  <div class="playlist-picker-content" id="playlistPickerContent">
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
</div>
{/if}
