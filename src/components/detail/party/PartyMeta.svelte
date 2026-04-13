<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { app } from '../../../lib/state/app.svelte.js'
  import { getImageUrl } from '../../../lib/constants.js'
  import Input from '../../shared/Input.svelte'
  import Select from '../../shared/Select.svelte'
  import Checkbox from '../../shared/Checkbox.svelte'
  import Tooltip from '../../shared/Tooltip.svelte'
  import Icon from '../../shared/Icon.svelte'

  type ElementName = 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark'
  let element = $derived((app.auth?.avatar?.element as ElementName) ?? undefined)

  let raidLabel = $derived.by(() => {
    const raid = app.selectedRaid
    if (!raid) return m.raid_select()
    const name =
      typeof raid.name === 'string'
        ? raid.name
        : (raid.name as { en?: string })?.en ?? 'Unknown'
    const level = raid.level ? ` Lv. ${raid.level}` : ''
    return `${name}${level}`
  })

  let raidImageUrl = $derived.by(() => {
    const raid = app.selectedRaid
    if (!raid?.slug) return ''
    return getImageUrl(`raid-thumbnail/${raid.slug}.png`)
  })

  let playlistLabel = $derived.by(() => {
    const playlists = app.selectedPlaylists
    if (!playlists || playlists.length === 0) return m.playlist_label()
    if (playlists.length === 1) return playlists[0]!.title
    return m.count_playlists({ count: playlists.length })
  })

  const visibilityOptions = $derived([
    { value: 1, label: m.visibility_anyone() },
    { value: 2, label: m.visibility_unlisted() },
    { value: 3, label: m.visibility_private() },
  ])

  function openRaidPicker() {
    app.raidPickerOpen = true
  }

  function openPlaylistPicker() {
    app.playlistPickerOpen = true
  }

  let raidImageError = $state(false)
</script>

<div class="party-meta" id="partyMeta">
  <div class="party-name-container" id="partyNameContainer">
    <Input
      type="text"
      contained
      id="partyNameInput"
      placeholder={m.party_name_placeholder()}
      bind:value={app.partyName}
    />
  </div>

  <div class="raid-selector" id="raidSelector">
    <button
      class="raid-selector-button"
      id="raidSelectorButton"
      onclick={openRaidPicker}
    >
      <span class="raid-selector-label" id="raidSelectorLabel">{raidLabel}</span>
      {#if raidImageUrl && !raidImageError}
        <img
          class="raid-selector-image"
          id="raidSelectorImage"
          src={raidImageUrl}
          alt=""
          onerror={() => (raidImageError = true)}
        />
      {/if}
      <Icon name="chevron-right" size={14} class="chevron" />
    </button>
  </div>

  <div class="visibility-row">
    <Select options={visibilityOptions} bind:value={app.selectedVisibility} contained fullWidth />

    {#if app.auth?.hasCrew}
      <Tooltip content={m.crew_share_tooltip()}>
        <div class="crew-share-toggle" id="crewShareToggle">
          <Checkbox checked={app.shareWithCrew} onCheckedChange={(c) => { app.shareWithCrew = c }} contained size="small" {element} />
          <span class="crew-share-label">{m.crew_label()}</span>
        </div>
      </Tooltip>
    {/if}
  </div>

  <div class="playlist-selector" id="playlistSelector">
    <button
      class="playlist-selector-button"
      id="playlistSelectorButton"
      onclick={openPlaylistPicker}
    >
      <span class="playlist-selector-label" id="playlistSelectorLabel">{playlistLabel}</span>
      <Icon name="chevron-right" size={14} class="chevron" />
    </button>
  </div>
</div>
