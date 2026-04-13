<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { app } from '../../../lib/state/app.svelte.js'
  import { getImageUrl } from '../../../lib/constants.js'

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

  let visibilityLabel = $derived.by(() => {
    switch (app.selectedVisibility) {
      case 1:
        return m.visibility_anyone()
      case 2:
        return m.visibility_unlisted()
      case 3:
        return m.visibility_private()
      default:
        return m.visibility_private()
    }
  })

  function openRaidPicker() {
    app.raidPickerOpen = true
  }

  function openPlaylistPicker() {
    app.playlistPickerOpen = true
  }

  function cycleVisibility() {
    // Cycle: 3 (private) -> 2 (unlisted) -> 1 (public) -> 3
    app.selectedVisibility =
      app.selectedVisibility === 3 ? 1 : app.selectedVisibility + 1
  }

  function toggleCrewShare() {
    app.shareWithCrew = !app.shareWithCrew
  }

  let raidImageError = $state(false)
</script>

<div class="party-meta" id="partyMeta">
  <div class="party-meta-row">
    <input
      type="text"
      class="party-name-input"
      id="partyNameInput"
      placeholder={m.party_name_placeholder()}
      bind:value={app.partyName}
    />
  </div>

  <div class="party-meta-row">
    <button
      class="selector-button raid-selector"
      id="raidSelectorButton"
      onclick={openRaidPicker}
    >
      {#if raidImageUrl && !raidImageError}
        <img
          class="raid-selector-image"
          id="raidSelectorImage"
          src={raidImageUrl}
          alt=""
          onerror={() => (raidImageError = true)}
        />
      {/if}
      <span id="raidSelectorLabel">{raidLabel}</span>
    </button>
  </div>

  <div class="party-meta-row">
    <button class="selector-button visibility-selector" onclick={cycleVisibility}>
      <span>{visibilityLabel}</span>
    </button>

    {#if app.auth?.hasCrew}
      <button
        class="crew-share-toggle"
        id="crewShareToggle"
        data-state={app.shareWithCrew ? 'checked' : 'unchecked'}
        onclick={toggleCrewShare}
      >
        <span>{m.crew_label()}</span>
      </button>
    {/if}
  </div>

  <div class="party-meta-row">
    <button
      class="selector-button playlist-selector"
      id="playlistSelectorButton"
      onclick={openPlaylistPicker}
    >
      <span id="playlistSelectorLabel">{playlistLabel}</span>
    </button>
  </div>
</div>
