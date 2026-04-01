/**
 * @fileoverview Playlist picker view for selecting playlists before party import.
 * Mirrors the raid-picker pattern with multi-select, search, and sheet-based creation.
 */

import { t, tPlural } from './i18n.js'

// ==========================================
// STATE
// ==========================================

let playlists = []
let selectedPlaylists = []
let searchQuery = ''
let onSelectCallback = null
let playlistVisibility = 3

const PLAYLIST_VISIBILITY_LABELS = {
  1: 'playlist_public',
  2: 'playlist_unlisted',
  3: 'playlist_private'
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Show the playlist picker view
 * @param {Object} options
 * @param {Array} options.currentPlaylists - Currently selected playlists (if any)
 * @param {Function} options.onSelect - Callback when done: (playlists) => void
 */
export async function showPlaylistPicker({ currentPlaylists = [], onSelect }) {
  selectedPlaylists = [...currentPlaylists]
  onSelectCallback = onSelect

  // Fetch playlists
  const response = await chrome.runtime.sendMessage({
    action: 'fetchUserPlaylists'
  })
  if (response.error) {
    console.error('Failed to fetch playlists:', response.error)
    return
  }

  playlists = response.data?.results || response.data || []

  renderPicker()
  bindEvents()

  // Slide in
  document.getElementById('playlistPickerView').classList.add('active')
}

/**
 * Hide the playlist picker view
 */
export function hidePlaylistPicker() {
  if (onSelectCallback) onSelectCallback(selectedPlaylists)
  hidePlaylistCreateView()
  document.getElementById('playlistPickerView').classList.remove('active')
  searchQuery = ''
}

/**
 * Get the currently selected playlists
 * @returns {Array}
 */
export function getSelectedPlaylists() {
  return selectedPlaylists
}

/**
 * Set the selected playlists programmatically
 * @param {Array} items
 */
export function setSelectedPlaylists(items) {
  selectedPlaylists = [...items]
}

/**
 * Clear the selected playlists
 */
export function clearSelectedPlaylists() {
  selectedPlaylists = []
}

// ==========================================
// RENDERING
// ==========================================

function renderPicker() {
  const container = document.getElementById('playlistPickerContent')
  if (!container) return

  // Reset search input
  const searchInput = document.getElementById('playlistSearchInput')
  if (searchInput) searchInput.value = ''
  searchQuery = ''

  // Render playlist list
  renderPlaylistList()
}

function renderPlaylistList() {
  const container = document.getElementById('playlistPickerContent')
  if (!container) return

  const filtered = getFilteredPlaylists()
  const query = searchQuery.trim()

  if (filtered.length === 0) {
    const escaped = query
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
    container.innerHTML = query
      ? `
        <button type="button" class="playlist-item playlist-create-prompt" data-prefill="${escaped}">
          <div class="playlist-item-info">
            <span class="playlist-item-title">${t('playlist_create_with', { name: query })}</span>
          </div>
        </button>
      `
      : `<div class="playlist-empty">${playlists.length === 0 ? t('playlist_no_playlists') : t('playlist_no_results')}</div>`
    return
  }

  container.innerHTML = filtered
    .map((playlist) => renderPlaylistItem(playlist))
    .join('')
}

function getFilteredPlaylists() {
  const query = searchQuery.toLowerCase().trim()

  if (!query) return playlists

  return playlists.filter((playlist) => {
    const title = (playlist.title || '').toLowerCase()
    const description = (playlist.description || '').toLowerCase()
    return title.includes(query) || description.includes(query)
  })
}

function renderPlaylistItem(playlist) {
  const isSelected = selectedPlaylists.some(
    (p) => String(p.id) === String(playlist.id)
  )
  const title = playlist.title || t('playlist_untitled')
  const partyCount = playlist.party_count || playlist.parties_count || 0
  const countText = tPlural('count_party', 'count_parties', partyCount)

  return `
    <button type="button" class="playlist-item ${isSelected ? 'selected' : ''}" data-playlist-id="${playlist.id}">
      <div class="playlist-item-info">
        <span class="playlist-item-title">${title}</span>
        <span class="playlist-item-count">${countText}</span>
      </div>
      ${isSelected ? '<svg class="playlist-item-check" viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M11.53 3.47a.75.75 0 0 1 .073.976l-.073.084-5.5 5.5a.75.75 0 0 1-.976.073l-.084-.073-2.5-2.5a.75.75 0 0 1 .976-1.133l.084.073L5.5 8.44l4.97-4.97a.75.75 0 0 1 1.06 0z"/></svg>' : ''}
    </button>
  `
}

function showPlaylistCreateView(prefillTitle) {
  if (prefillTitle) {
    const titleInput = document.getElementById('playlistCreateTitle')
    if (titleInput) titleInput.value = prefillTitle
  }
  document.getElementById('playlistCreateView')?.classList.add('active')
  updateCreateSubmitState()
}

function hidePlaylistCreateView() {
  const view = document.getElementById('playlistCreateView')
  if (!view) return
  view.classList.remove('active')

  // Clear form fields
  const titleInput = view.querySelector('#playlistCreateTitle')
  const descInput = view.querySelector('#playlistCreateDescription')
  const errorEl = view.querySelector('.playlist-create-error')
  if (titleInput) titleInput.value = ''
  if (descInput) descInput.value = ''
  if (errorEl) errorEl.textContent = ''
  updateCreateSubmitState()
  playlistVisibility = 3
  updatePlaylistVisibilityLabel()
  updatePlaylistVisibilitySelection()
}

// ==========================================
// EVENT BINDING
// ==========================================

let eventsBound = false

function bindEvents() {
  if (eventsBound) return
  eventsBound = true

  // Back button
  document
    .getElementById('playlistPickerBack')
    ?.addEventListener('click', hidePlaylistPicker)

  // Search input
  document
    .getElementById('playlistSearchInput')
    ?.addEventListener('input', (e) => {
      searchQuery = e.target.value
      renderPlaylistList()
    })

  // Create button (show create view)
  document
    .getElementById('playlistCreateBtn')
    ?.addEventListener('click', () => showPlaylistCreateView())

  // Validate create form on title input
  document
    .getElementById('playlistCreateTitle')
    ?.addEventListener('input', updateCreateSubmitState)

  // Create view back button
  document
    .getElementById('playlistCreateBack')
    ?.addEventListener('click', hidePlaylistCreateView)

  // Playlist visibility selector
  const plVisBtn = document.getElementById('playlistVisibilityButton')
  const plVisDrop = document.getElementById('playlistVisibilityDropdown')

  plVisBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    plVisDrop?.classList.toggle('hidden')
  })

  plVisDrop?.querySelectorAll('.visibility-option').forEach((option) => {
    option.addEventListener('click', () => {
      playlistVisibility = parseInt(option.dataset.value, 10)
      updatePlaylistVisibilityLabel()
      updatePlaylistVisibilitySelection()
      plVisDrop.classList.add('hidden')
    })
  })

  document.addEventListener('click', (e) => {
    if (
      plVisBtn &&
      plVisDrop &&
      !plVisBtn.contains(e.target) &&
      !plVisDrop.contains(e.target)
    ) {
      plVisDrop.classList.add('hidden')
    }
  })

  // Submit create form
  document
    .getElementById('playlistCreateSubmit')
    ?.addEventListener('click', handleCreatePlaylist)

  // Playlist item clicks (delegated)
  document
    .getElementById('playlistPickerContent')
    ?.addEventListener('click', (e) => {
      const createPrompt = e.target.closest('.playlist-create-prompt')
      if (createPrompt) {
        showPlaylistCreateView(createPrompt.dataset.prefill)
        return
      }

      const playlistItem = e.target.closest('.playlist-item')
      if (!playlistItem) return

      const playlistId = playlistItem.dataset.playlistId
      const playlist = playlists.find((p) => String(p.id) === playlistId)
      if (!playlist) return

      // Toggle: clicking toggles selection
      const existingIndex = selectedPlaylists.findIndex(
        (p) => String(p.id) === String(playlist.id)
      )
      if (existingIndex >= 0) {
        selectedPlaylists.splice(existingIndex, 1)
      } else {
        selectedPlaylists.push(playlist)
      }

      renderPlaylistList()
    })

  // Done button
  document
    .getElementById('playlistPickerDone')
    ?.addEventListener('click', hidePlaylistPicker)
}

async function handleCreatePlaylist() {
  const titleInput = document.getElementById('playlistCreateTitle')
  const descInput = document.getElementById('playlistCreateDescription')
  const errorEl = document.querySelector('.playlist-create-error')
  const submitBtn = document.getElementById('playlistCreateSubmit')

  const title = titleInput?.value?.trim()
  if (!title) {
    if (errorEl) errorEl.textContent = t('playlist_title_required')
    return
  }

  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = t('action_creating')
  }
  if (errorEl) errorEl.textContent = ''

  const response = await chrome.runtime.sendMessage({
    action: 'createPlaylist',
    data: {
      title,
      description: descInput?.value?.trim() || '',
      visibility: playlistVisibility
    }
  })

  if (submitBtn) {
    submitBtn.disabled = false
    submitBtn.textContent = t('action_create')
  }

  if (response.error) {
    if (errorEl) errorEl.textContent = response.error
    return
  }

  // Auto-select the new playlist
  const responseData = response.data || response
  const newPlaylist = responseData.playlist || responseData
  if (!newPlaylist.title) newPlaylist.title = title
  selectedPlaylists.push(newPlaylist)

  // Re-fetch playlists, clear search, and go back
  const refreshResponse = await chrome.runtime.sendMessage({
    action: 'fetchUserPlaylists'
  })
  playlists = refreshResponse.data?.results || refreshResponse.data || []

  // Reconcile selected playlists with fresh data
  selectedPlaylists = selectedPlaylists.map(
    (s) => playlists.find((p) => String(p.id) === String(s.id)) || s
  )

  searchQuery = ''
  const searchInput = document.getElementById('playlistSearchInput')
  if (searchInput) searchInput.value = ''

  hidePlaylistCreateView()
  renderPlaylistList()
}

function updatePlaylistVisibilityLabel() {
  const label = document.getElementById('playlistVisibilityLabel')
  if (label)
    label.textContent = t(PLAYLIST_VISIBILITY_LABELS[playlistVisibility])
}

function updateCreateSubmitState() {
  const title = document.getElementById('playlistCreateTitle')?.value?.trim()
  const btn = document.getElementById('playlistCreateSubmit')
  if (btn) btn.disabled = !title
}

function updatePlaylistVisibilitySelection() {
  const dropdown = document.getElementById('playlistVisibilityDropdown')
  if (!dropdown) return
  dropdown.querySelectorAll('.visibility-option').forEach((opt) => {
    opt.classList.toggle(
      'selected',
      parseInt(opt.dataset.value, 10) === playlistVisibility
    )
  })
}
