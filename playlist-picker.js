/**
 * @fileoverview Playlist picker view for selecting playlists before party import.
 * Mirrors the raid-picker pattern with multi-select, search, and inline creation.
 */

import { t, tPlural } from './i18n.js'

// ==========================================
// STATE
// ==========================================

let playlists = []
let selectedPlaylists = []
let searchQuery = ''
let onSelectCallback = null
let showCreateForm = false

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
  showCreateForm = false

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
  document.getElementById('playlistPickerView').classList.remove('active')
  searchQuery = ''
  showCreateForm = false
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

  // Update create form visibility
  updateCreateForm()

  // Render playlist list
  renderPlaylistList()
}

function renderPlaylistList() {
  const container = document.getElementById('playlistPickerContent')
  if (!container) return

  const filtered = getFilteredPlaylists()

  if (playlists.length === 0) {
    container.innerHTML = `<div class="playlist-empty">${t('playlist_no_playlists')}</div>`
    return
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="playlist-empty">${t('playlist_no_results')}</div>`
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
  const isSelected = selectedPlaylists.some((p) => p.id === playlist.id)
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

function updateCreateForm() {
  const form = document.getElementById('playlistCreateForm')
  if (!form) return

  if (showCreateForm) {
    form.classList.remove('hidden')
  } else {
    form.classList.add('hidden')
    // Clear form fields
    const titleInput = form.querySelector('#playlistCreateTitle')
    const descInput = form.querySelector('#playlistCreateDescription')
    const visInput = form.querySelector('#playlistCreateVisibility')
    const errorEl = form.querySelector('.playlist-create-error')
    if (titleInput) titleInput.value = ''
    if (descInput) descInput.value = ''
    if (visInput) visInput.value = '3'
    if (errorEl) errorEl.textContent = ''
  }
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

  // Create button (toggle form)
  document
    .getElementById('playlistCreateBtn')
    ?.addEventListener('click', () => {
      showCreateForm = !showCreateForm
      updateCreateForm()
    })

  // Submit create form
  document
    .getElementById('playlistCreateSubmit')
    ?.addEventListener('click', handleCreatePlaylist)

  // Playlist item clicks (delegated)
  document
    .getElementById('playlistPickerContent')
    ?.addEventListener('click', (e) => {
      const playlistItem = e.target.closest('.playlist-item')
      if (!playlistItem) return

      const playlistId = playlistItem.dataset.playlistId
      const playlist = playlists.find((p) => p.id === playlistId)
      if (!playlist) return

      // Toggle: clicking toggles selection
      const existingIndex = selectedPlaylists.findIndex(
        (p) => p.id === playlist.id
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
    ?.addEventListener('click', () => {
      if (onSelectCallback) onSelectCallback(selectedPlaylists)
      hidePlaylistPicker()
    })
}

async function handleCreatePlaylist() {
  const titleInput = document.getElementById('playlistCreateTitle')
  const descInput = document.getElementById('playlistCreateDescription')
  const visInput = document.getElementById('playlistCreateVisibility')
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
      visibility: parseInt(visInput?.value || '3')
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

  // Add new playlist to local list and auto-select it
  const newPlaylist = response.data || response
  playlists.unshift(newPlaylist)
  selectedPlaylists.push(newPlaylist)

  // Hide form and re-render
  showCreateForm = false
  updateCreateForm()
  renderPlaylistList()
}
