/**
 * @fileoverview Raid picker view for selecting a raid before party import.
 * Mirrors the hensei-svelte EditRaidPane design with search, section tabs, and sort.
 */

import { RAID_SECTIONS } from './constants.js'
import { getImageUrl } from './constants.js'

// ==========================================
// STATE
// ==========================================

let raidGroups = []
let selectedSection = RAID_SECTIONS.RAID
let searchQuery = ''
let sortAscending = false
let selectedRaid = null
let onSelectCallback = null

// ==========================================
// SECTION LABELS
// ==========================================

const SECTION_LABELS = {
  [RAID_SECTIONS.FARMING]: 'Farming',
  [RAID_SECTIONS.RAID]: 'Raids',
  [RAID_SECTIONS.EVENT]: 'Events',
  [RAID_SECTIONS.SOLO]: 'Solo'
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Show the raid picker view
 * @param {Object} options
 * @param {Object|null} options.currentRaid - Currently selected raid (if any)
 * @param {Function} options.onSelect - Callback when a raid is selected: (raid) => void
 */
export async function showRaidPicker({ currentRaid = null, onSelect }) {
  selectedRaid = currentRaid
  onSelectCallback = onSelect

  // Fetch raid groups
  const response = await chrome.runtime.sendMessage({ action: 'fetchRaidGroups' })
  if (response.error) {
    console.error('Failed to fetch raid groups:', response.error)
    return
  }

  raidGroups = response.data || []

  renderPicker()
  bindEvents()

  // Slide in
  document.getElementById('raidPickerView').classList.add('active')
}

/**
 * Hide the raid picker view
 */
export function hideRaidPicker() {
  document.getElementById('raidPickerView').classList.remove('active')
  searchQuery = ''
}

/**
 * Get the currently selected raid
 * @returns {Object|null}
 */
export function getSelectedRaid() {
  return selectedRaid
}

/**
 * Set the selected raid programmatically (for auto-suggestion)
 * @param {Object|null} raid
 */
export function setSelectedRaid(raid) {
  selectedRaid = raid
}

/**
 * Clear the selected raid
 */
export function clearSelectedRaid() {
  selectedRaid = null
}

// ==========================================
// RENDERING
// ==========================================

function renderPicker() {
  const container = document.getElementById('raidPickerContent')
  if (!container) return

  // Reset search input
  const searchInput = document.getElementById('raidSearchInput')
  if (searchInput) searchInput.value = ''
  searchQuery = ''

  // Update active section tab
  updateSectionTabs()
  updateSortButton()

  // Render raid list
  renderRaidList()
}

function updateSectionTabs() {
  document.querySelectorAll('.raid-section-tab').forEach(tab => {
    const section = parseInt(tab.dataset.section)
    tab.classList.toggle('active', section === selectedSection)
  })
}

function updateSortButton() {
  const sortBtn = document.getElementById('raidSortBtn')
  if (sortBtn) {
    sortBtn.innerHTML = sortAscending
      ? '<svg viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M2.04805 6.94536C1.65772 6.55487 1.65772 5.92178 2.04805 5.5313L6.29122 1.28911C6.46389 1.11655 6.68384 1.01998 6.90938 1.00005C7.19607 0.972746 7.49257 1.06957 7.71212 1.28911L11.9553 5.5313C12.3451 5.92172 12.3452 6.55497 11.9553 6.94536C11.5649 7.33563 10.9318 7.33534 10.5412 6.94536L8.00508 4.4102L8.00508 11.9981C8.00508 12.5502 7.55711 12.9978 7.00508 12.9981C6.4528 12.9981 6.00508 12.5504 6.00508 11.9981L6.00508 4.40337L3.46212 6.94536C3.07171 7.33561 2.43856 7.33544 2.04805 6.94536Z"/></svg>'
      : '<svg viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M11.9546 7.04822C12.3449 7.43871 12.3449 8.07179 11.9546 8.46228L7.7114 12.7045C7.53873 12.877 7.31878 12.9736 7.09323 12.9935C6.80654 13.0208 6.51004 12.924 6.2905 12.7045L2.04734 8.46228C1.65747 8.07186 1.65742 7.43861 2.04734 7.04822C2.4377 6.65794 3.07086 6.65823 3.4614 7.04822L5.99753 9.58337L5.99753 1.99548C5.99753 1.44339 6.44551 0.995793 6.99753 0.995483C7.54982 0.995483 7.99753 1.4432 7.99753 1.99548L7.99753 9.59021L10.5405 7.04822C10.9309 6.65797 11.5641 6.65814 11.9546 7.04822Z"/></svg>'
  }
}

function renderRaidList() {
  const container = document.getElementById('raidPickerContent')
  if (!container) return

  const filtered = getFilteredGroups()

  if (filtered.length === 0) {
    container.innerHTML = '<div class="raid-empty-state">No raids found</div>'
    return
  }

  container.innerHTML = filtered.map(group => renderRaidGroup(group)).join('')
}

function getFilteredGroups() {
  const query = searchQuery.toLowerCase().trim()

  // Filter by section
  let groups = raidGroups.filter(group => {
    const section = typeof group.section === 'string' ? parseInt(group.section) : group.section
    return section === selectedSection
  })

  // Sort by difficulty
  groups = [...groups].sort((a, b) => {
    const diff = a.difficulty - b.difficulty
    return sortAscending ? diff : -diff
  })

  // Filter by search query
  if (query) {
    groups = groups.map(group => {
      const groupName = getGroupName(group).toLowerCase()
      if (groupName.includes(query)) return group

      const matchingRaids = (group.raids || []).filter(raid => {
        const raidName = getRaidName(raid).toLowerCase()
        const raidNameJp = getRaidNameJp(raid).toLowerCase()
        return raidName.includes(query) || raidNameJp.includes(query)
      })

      if (matchingRaids.length > 0) {
        return { ...group, raids: matchingRaids }
      }
      return null
    }).filter(Boolean)
  }

  return groups
}

function renderRaidGroup(group) {
  const raids = group.raids || []
  if (raids.length === 0) return ''

  const groupName = getGroupName(group)
  const extraBadge = group.extra ? '<span class="raid-ex-badge">EX</span>' : ''

  return `
    <div class="raid-group">
      <div class="raid-group-header">
        <span class="raid-group-name">${groupName}</span>
        ${extraBadge}
      </div>
      <div class="raid-group-raids">
        ${raids.map(raid => renderRaidItem(raid)).join('')}
      </div>
    </div>
  `
}

function renderRaidItem(raid) {
  const isSelected = selectedRaid && raid.id === selectedRaid.id
  const name = getRaidName(raid)
  const level = raid.level
  const imageUrl = getRaidImageUrl(raid)

  return `
    <button type="button" class="raid-item ${isSelected ? 'selected' : ''}" data-raid-id="${raid.id}">
      <img src="${imageUrl}" alt="" class="raid-item-icon" onerror="this.style.display='none'">
      <div class="raid-item-info">
        <span class="raid-item-name">${name}</span>
        ${level ? `<span class="raid-item-level">Lv. ${level}</span>` : ''}
      </div>
      ${isSelected ? '<svg class="raid-item-check" viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M11.53 3.47a.75.75 0 0 1 .073.976l-.073.084-5.5 5.5a.75.75 0 0 1-.976.073l-.084-.073-2.5-2.5a.75.75 0 0 1 .976-1.133l.084.073L5.5 8.44l4.97-4.97a.75.75 0 0 1 1.06 0z"/></svg>' : ''}
    </button>
  `
}

// ==========================================
// HELPERS
// ==========================================

function getGroupName(group) {
  if (typeof group.name === 'string') return group.name
  return group.name?.en || group.name_en || group.name?.ja || group.name_jp || 'Unknown'
}

function getRaidName(raid) {
  if (typeof raid.name === 'string') return raid.name
  return raid.name?.en || raid.name_en || raid.name?.ja || raid.name_jp || 'Unknown'
}

function getRaidNameJp(raid) {
  if (typeof raid.name === 'string') return ''
  return raid.name?.ja || raid.name_jp || ''
}

function getRaidImageUrl(raid) {
  if (raid.slug) {
    return getImageUrl(`raid-thumbnail/${raid.slug}.png`)
  }
  return ''
}

// ==========================================
// EVENT BINDING
// ==========================================

let eventsBound = false

function bindEvents() {
  if (eventsBound) return
  eventsBound = true

  // Back button
  document.getElementById('raidPickerBack')?.addEventListener('click', hideRaidPicker)

  // Search input
  document.getElementById('raidSearchInput')?.addEventListener('input', (e) => {
    searchQuery = e.target.value
    renderRaidList()
  })

  // Section tabs
  document.querySelectorAll('.raid-section-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      selectedSection = parseInt(tab.dataset.section)
      updateSectionTabs()
      renderRaidList()
    })
  })

  // Sort button
  document.getElementById('raidSortBtn')?.addEventListener('click', () => {
    sortAscending = !sortAscending
    updateSortButton()
    renderRaidList()
  })

  // Refresh button
  document.getElementById('raidRefreshBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('raidRefreshBtn')
    btn.classList.add('loading')

    const response = await chrome.runtime.sendMessage({ action: 'fetchRaidGroups', forceRefresh: true })
    if (response.error) {
      console.error('Failed to refresh raid groups:', response.error)
    } else {
      raidGroups = response.data || []
      renderRaidList()
    }

    btn.classList.remove('loading')
  })

  // Raid item clicks (delegated)
  document.getElementById('raidPickerContent')?.addEventListener('click', (e) => {
    const raidItem = e.target.closest('.raid-item')
    if (!raidItem) return

    const raidId = raidItem.dataset.raidId
    const raid = findRaidById(raidId)
    if (!raid) return

    // Toggle: clicking selected raid unselects it
    if (selectedRaid && selectedRaid.id === raid.id) {
      selectedRaid = null
    } else {
      selectedRaid = raid
    }

    if (onSelectCallback) onSelectCallback(selectedRaid)
    hideRaidPicker()
  })
}

function findRaidById(id) {
  for (const group of raidGroups) {
    const raid = (group.raids || []).find(r => r.id === id)
    if (raid) return { ...raid, group }
  }
  return null
}
