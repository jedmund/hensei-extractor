/**
 * @fileoverview Popup script for the Granblue Fantasy Chrome extension.
 * Handles tab navigation, authentication, and data operations.
 */

import { performLogin, fetchUserInfo } from "./auth.js"
import { formatCacheStatus, formatAge } from "./cache.js"
import {
  getDataTypeName,
  TAB_DATA_TYPES,
  getImageUrl,
  getApiUrl,
  getSiteBaseUrl
} from "./constants.js"
import {
  show,
  hide,
  setElementColor,
  clearElementColors
} from "./dom.js"
import {
  OVER_MASTERY_NAMES, AETHERIAL_NAMES, PERPETUITY_NAMES,
  formatModifier, formatPerpetuityBonus
} from "./mastery.js"
import { RARITY_LABELS, GAME_ELEMENT_NAMES } from "./game-data.js"
import { handleDetailSync, hideSyncModal, confirmSync } from "./sync.js"
import { showConflictModal, hideConflictModal, initConflictListeners } from "./conflict-resolution.js"
import {
  isCollectionType, isDatabaseDetailType, isWeaponOrSummonCollection,
  toArray, extractItems, countItems,
  getItemImageUrl, getArtifactLabels, getGridClass,
  getCharacterModifiers, renderCharacterModifiers, getWeaponModifiers, renderWeaponModifiers,
  renderPartyDetail, renderDatabaseDetail
} from "./render-detail.js"
import {
  showRaidPicker, hideRaidPicker, getSelectedRaid, setSelectedRaid, clearSelectedRaid
} from "./raid-picker.js"
import {
  showPlaylistPicker, hidePlaylistPicker, getSelectedPlaylists, clearSelectedPlaylists
} from "./playlist-picker.js"

// ==========================================
// STATE
// ==========================================

let activeTab = 'party'
let selectedDataTypes = {
  party: null,
  collection: null,
  database: null
}
let cachedStatus = null

// Detail view navigation state
let detailViewActive = false
let currentDetailDataType = null
let selectedItems = new Set() // Track selected item indices for collection views
let manuallyUnchecked = new Set() // Track items user explicitly unchecked (persists across re-renders)
let brokenImageIndices = new Set() // Track items with broken images (persists across re-renders)

// Filter state
let activeRarityFilters = new Set(['4']) // SSR by default
let excludeLv1Items = true

// Conflict resolution state
let pendingConflicts = null // Array of conflict objects from API
let conflictResolutions = null // Map of game_id → 'import' | 'skip' (after user review)

// Age ticker state
let ageTickerInterval = null

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // Set CSS variables for images
  document.documentElement.style.setProperty(
    '--login-bg-image',
    `url('${getImageUrl('port-breeze.jpg')}')`
  )

  initializeApp()
})

/**
 * Initialize the app based on auth state
 */
async function initializeApp() {
  const { gbAuth, noticeAcknowledged } = await chrome.storage.local.get([
    'gbAuth',
    'noticeAcknowledged'
  ])

  const loginView = document.getElementById('loginView')
  const mainView = document.getElementById('mainView')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  if (gbAuth?.access_token) {
    // User is logged in - show main view
    hide(loginView)
    show(mainView)

    updateProfileUI(gbAuth)
    updateTabVisibility(gbAuth.role)
    initializeEventListeners()
    refreshAllCaches()
    startAgeTicker()
    checkForUpdate()
  } else {
    // User not logged in - show login view
    show(loginView)
    hide(mainView)

    // Handle warning acknowledgment
    if (noticeAcknowledged) {
      hide(warning)
      show(loginFormContainer)
    } else {
      show(warning)
      hide(loginFormContainer)
    }

    initializeLoginListeners()
  }

  // Set up message listener for data capture events
  chrome.runtime.onMessage.addListener(handleMessages)
}

// ==========================================
// EVENT LISTENERS
// ==========================================

/**
 * Set up login view event listeners
 */
function initializeLoginListeners() {
  const acknowledgeButton = document.getElementById('acknowledgeButton')
  const loginButton = document.getElementById('loginButton')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  acknowledgeButton?.addEventListener('click', () => {
    chrome.storage.local.set({ noticeAcknowledged: true })
    hide(warning)
    show(loginFormContainer)
  })

  loginButton?.addEventListener('click', handleLogin)

  // Handle enter key in login form
  document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin()
  })
}

/**
 * Set up main view event listeners
 */
function initializeEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab)
    })
  })

  // Profile popover toggle
  document.getElementById('profileButton')?.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleProfilePopover()
  })

  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('profilePopover')
    if (!popover?.classList.contains('hidden') && !popover?.contains(e.target)) {
      hideProfilePopover()
    }
  })

  // Profile actions (close popover after action)
  document.getElementById('logoutButton')?.addEventListener('click', () => {
    hideProfilePopover()
    handleLogout()
  })
  document.getElementById('clearCacheButton')?.addEventListener('click', () => {
    hideProfilePopover()
    handleClearCache()
  })
  document.getElementById('showWarning')?.addEventListener('click', () => {
    hideProfilePopover()
    handleShowWarning()
  })

  // Detail view buttons
  document.getElementById('detailBack')?.addEventListener('click', hideDetailView)
  // Copy dropdown toggle
  const copyDropdownToggle = document.getElementById('copyDropdownToggle')
  const copyDropdownMenu = document.getElementById('copyDropdownMenu')

  copyDropdownToggle?.addEventListener('click', (e) => {
    e.stopPropagation()
    copyDropdownMenu.classList.toggle('open')
  })

  copyDropdownMenu?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]')
    if (!item) return
    copyDropdownMenu.classList.remove('open')
    if (item.dataset.action === 'copy') handleDetailCopy()
    else if (item.dataset.action === 'save') handleDetailSave()
  })

  document.addEventListener('click', () => {
    copyDropdownMenu?.classList.remove('open')
  })
  document.getElementById('detailImport')?.addEventListener('click', handleDetailImport)
  document.getElementById('detailSync')?.addEventListener('click', () => handleDetailSync(currentDetailDataType, showToast))
  document.getElementById('detailReview')?.addEventListener('click', handleDetailReview)

  // Raid selector button
  document.getElementById('raidSelectorButton')?.addEventListener('click', () => {
    showRaidPicker({
      currentRaid: getSelectedRaid(),
      onSelect: (raid) => updateRaidSelectorUI(raid)
    })
  })

  // Playlist selector button
  document.getElementById('playlistSelectorButton')?.addEventListener('click', () => {
    showPlaylistPicker({
      currentPlaylists: getSelectedPlaylists(),
      onSelect: (playlists) => updatePlaylistSelectorUI(playlists)
    })
  })

  // Sync modal buttons
  document.getElementById('cancelSync')?.addEventListener('click', hideSyncModal)
  document.getElementById('confirmSync')?.addEventListener('click', () => confirmSync(currentDetailDataType, showToast))
  document.querySelector('#syncModal .modal-backdrop')?.addEventListener('click', hideSyncModal)

  // Conflict modal listeners
  initConflictListeners()

  // Filter listeners
  initializeFilterListeners()
}

// ==========================================
// TAB NAVIGATION
// ==========================================

/**
 * Switch to a different tab
 */
function switchTab(tabName) {
  // Close profile popover when switching tabs
  hideProfilePopover()
  activeTab = tabName

  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName)
  })

  // Update panels
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('active', p.id === `${tabName}Panel`)
  })

  // Refresh cache display for this tab
  if (cachedStatus) {
    updateTabCacheDisplay(tabName, cachedStatus)
  }
}

/**
 * Show/hide Database tab based on user role
 */
function updateTabVisibility(userRole) {
  const databaseTab = document.getElementById('databaseTab')
  if (userRole >= 7) {
    databaseTab?.classList.remove('hidden')
  } else {
    databaseTab?.classList.add('hidden')
  }
}

// ==========================================
// PROFILE POPOVER
// ==========================================

/**
 * Toggle profile popover visibility
 */
function toggleProfilePopover() {
  const popover = document.getElementById('profilePopover')
  const button = document.getElementById('profileButton')
  if (popover?.classList.contains('hidden')) {
    popover.classList.remove('hidden')
    button?.classList.add('active')
  } else {
    hideProfilePopover()
  }
}

/**
 * Hide profile popover
 */
function hideProfilePopover() {
  document.getElementById('profilePopover')?.classList.add('hidden')
  document.getElementById('profileButton')?.classList.remove('active')
}

// ==========================================
// DETAIL VIEW NAVIGATION
// ==========================================

/**
 * Show detail view for a data type
 */
async function showDetailView(dataType) {
  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType
  })

  if (response.error) {
    showTabStatus(activeTab, response.error, 'error')
    return
  }

  currentDetailDataType = dataType

  // Update metadata
  const status = cachedStatus[dataType]
  document.getElementById('detailFreshness').textContent = status.ageText

  if (dataType.startsWith('party_')) {
    // Party counts are shown inline in section labels — hide the meta row
    const deck = response.data.deck || {}
    const pc = deck.pc || {}
    const chars = toArray(deck.npc).filter(Boolean).length
    const wpns = toArray(pc.weapons).filter(Boolean).length
    document.getElementById('detailPageCount').textContent = ''
    document.getElementById('detailItemCount').textContent = ''
    document.querySelector('.detail-meta')?.classList.add('hidden')

    // Show party meta and pre-fill name from deck data
    document.getElementById('partyMeta')?.classList.remove('hidden')
    const partyNameInput = document.getElementById('partyNameInput')
    if (partyNameInput) partyNameInput.value = deck.name || ''
    autoSuggestRaid(wpns, chars)
  } else if (dataType === 'character_stats') {
    // Character stats shows character count
    const characterCount = Object.keys(response.data).length
    document.getElementById('detailPageCount').textContent = ''
    document.getElementById('detailItemCount').textContent = `${characterCount} characters`
  } else if (isDatabaseDetailType(dataType)) {
    // Database detail shows item name
    const name = response.data.name || response.data.master?.name || ''
    document.getElementById('detailPageCount').textContent = ''
    document.getElementById('detailItemCount').textContent = name
  } else {
    document.getElementById('detailPageCount').textContent = status.pageCount ? `${status.pageCount} pages` : ''
    document.getElementById('detailItemCount').textContent = `${status.totalItems || countItems(dataType, response.data)} items`
  }

  // Hide party meta and show detail meta row for non-party types
  if (!dataType.startsWith('party_')) {
    document.getElementById('partyMeta')?.classList.add('hidden')
    document.querySelector('.detail-meta')?.classList.remove('hidden')
    clearSelectedRaid()
    clearSelectedPlaylists()
    updatePlaylistSelectorUI([])
  }

  // Reset import button
  const importBtn = document.getElementById('detailImport')
  importBtn.textContent = 'Import'
  importBtn.disabled = false
  importBtn.classList.remove('imported')

  // Show/hide sync button based on checkbox state (user-controlled)
  const syncBtn = document.getElementById('detailSync')
  const enableSyncCheckbox = document.getElementById('enableFullSyncCheckbox')
  const isCollectionSync = isCollectionType(dataType) && dataType !== 'character_stats'
  if (syncBtn) {
    // Sync button visibility is controlled by checkbox, not isComplete
    if (isCollectionSync && enableSyncCheckbox?.checked) {
      syncBtn.classList.remove('hidden')
      syncBtn.textContent = 'Full Sync'
      syncBtn.disabled = false
    } else {
      syncBtn.classList.add('hidden')
    }
  }

  // Show/hide filter based on data type
  const detailFilter = document.getElementById('detailFilter')
  const rarityFilters = document.getElementById('rarityFilters')
  const lv1FilterDivider = document.getElementById('lv1FilterDivider')
  const lv1FilterOption = document.getElementById('lv1FilterOption')
  const syncFilterDivider = document.getElementById('syncFilterDivider')
  const syncFilterOption = document.getElementById('syncFilterOption')
  const filterButton = document.getElementById('filterButton')

  // Show filter for weapons, summons, and artifacts (collection types that support sync)
  const showFilter = isWeaponOrSummonCollection(dataType) || dataType === 'collection_artifact'
  const isArtifact = dataType === 'collection_artifact'

  if (showFilter) {
    detailFilter?.classList.remove('hidden')

    // Rarity and Lv1 filters only for weapons/summons (not artifacts)
    if (isWeaponOrSummonCollection(dataType)) {
      rarityFilters?.classList.remove('hidden')
      lv1FilterDivider?.classList.remove('hidden')
      lv1FilterOption?.classList.remove('hidden')
      updateFilterButtonLabel()
    } else {
      rarityFilters?.classList.add('hidden')
      lv1FilterDivider?.classList.add('hidden')
      lv1FilterOption?.classList.add('hidden')
      // For artifacts, just show "Filter" as the button label
      if (filterButton) {
        filterButton.querySelector('span').textContent = 'Options'
      }
    }

    // Sync filter for all collection types
    if (isCollectionSync) {
      syncFilterDivider?.classList.remove('hidden')
      syncFilterOption?.classList.remove('hidden')
      // For artifacts, no divider needed since it's the only option
      if (isArtifact) {
        syncFilterDivider?.classList.add('hidden')
      }
    } else {
      syncFilterDivider?.classList.add('hidden')
      syncFilterOption?.classList.add('hidden')
    }
  } else {
    detailFilter?.classList.add('hidden')
    rarityFilters?.classList.add('hidden')
    lv1FilterDivider?.classList.add('hidden')
    lv1FilterOption?.classList.add('hidden')
    syncFilterDivider?.classList.add('hidden')
    syncFilterOption?.classList.add('hidden')
  }

  // Render items
  renderDetailItems(dataType, response.data)

  // Slide in
  document.getElementById('detailView').classList.add('active')
  detailViewActive = true
}

/**
 * Hide detail view
 */
function hideDetailView() {
  document.getElementById('detailView').classList.remove('active')
  detailViewActive = false
  currentDetailDataType = null
  // Clear selection state for next view
  selectedItems.clear()
  manuallyUnchecked.clear()
  brokenImageIndices.clear()

  // Reset sync button state
  const syncBtn = document.getElementById('detailSync')
  if (syncBtn) {
    syncBtn.classList.add('hidden')
    syncBtn.classList.remove('synced')
    syncBtn.disabled = false
    syncBtn.textContent = 'Full Sync'
  }

  // Reset sync checkbox
  const enableSyncCheckbox = document.getElementById('enableFullSyncCheckbox')
  if (enableSyncCheckbox) {
    enableSyncCheckbox.checked = false
  }

  // Reset party meta
  const partyNameInput = document.getElementById('partyNameInput')
  if (partyNameInput) partyNameInput.value = ''
  document.getElementById('partyMeta')?.classList.add('hidden')
  clearSelectedRaid()
  updateRaidSelectorUI(null)
  clearSelectedPlaylists()
  updatePlaylistSelectorUI([])

  // Reset conflict state
  pendingConflicts = null
  conflictResolutions = null
  const reviewBtn = document.getElementById('detailReview')
  if (reviewBtn) {
    reviewBtn.classList.add('hidden')
    reviewBtn.classList.remove('imported')
    reviewBtn.textContent = 'Review'
  }
}

// ==========================================
// RAID SELECTOR
// ==========================================

/**
 * Update the raid selector button UI to reflect the selected raid
 * @param {Object|null} raid
 */
const RAID_ELEMENT_CLASSES = {
  0: 'raid-null',
  1: 'raid-wind',
  2: 'raid-fire',
  3: 'raid-water',
  4: 'raid-earth',
  5: 'raid-dark',
  6: 'raid-light'
}

function updateRaidSelectorUI(raid) {
  const label = document.getElementById('raidSelectorLabel')
  const btn = document.getElementById('raidSelectorButton')
  const img = document.getElementById('raidSelectorImage')
  if (!label || !btn) return

  // Remove any previous element class
  Object.values(RAID_ELEMENT_CLASSES).forEach(cls => btn.classList.remove(cls))

  if (raid) {
    const name = typeof raid.name === 'string' ? raid.name : (raid.name?.en || raid.name_en || 'Unknown')
    const level = raid.level ? ` Lv. ${raid.level}` : ''
    label.textContent = `${name}${level}`
    const elementClass = RAID_ELEMENT_CLASSES[raid.element] || 'raid-null'
    btn.classList.add(elementClass)

    // Show raid thumbnail
    if (img && raid.slug) {
      img.src = getImageUrl(`raid-thumbnail/${raid.slug}.png`)
      img.classList.remove('hidden')
      img.onerror = () => img.classList.add('hidden')
    }

    setSelectedRaid(raid)
  } else {
    label.textContent = 'Select Raid'

    if (img) {
      img.src = ''
      img.classList.add('hidden')
    }
    clearSelectedRaid()
  }
}

// ==========================================
// PLAYLIST SELECTOR
// ==========================================

/**
 * Update the playlist selector button UI to reflect the selected playlists
 * @param {Array} playlists
 */
function updatePlaylistSelectorUI(playlists) {
  const label = document.getElementById('playlistSelectorLabel')
  if (!label) return
  if (!playlists || playlists.length === 0) {
    label.textContent = 'Playlists'
  } else if (playlists.length === 1) {
    label.textContent = playlists[0].title
  } else {
    label.textContent = `${playlists.length} playlists selected`
  }
}

/**
 * Auto-suggest a raid based on weapon and character counts
 * @param {number} weaponCount
 * @param {number} characterCount
 */
async function autoSuggestRaid(weaponCount, characterCount) {
  // Fetch raid groups to find matching raids
  const response = await chrome.runtime.sendMessage({ action: 'fetchRaidGroups' })
  if (response.error || !response.data) return

  const groups = response.data
  let suggestedRaid = null

  if (weaponCount === 13 && characterCount === 8) {
    suggestedRaid = findRaidBySlug(groups, 'versusia')
  } else if (weaponCount === 13 && characterCount === 5) {
    suggestedRaid = findRaidBySlug(groups, 'farming-ex')
  } else if (characterCount === 5) {
    suggestedRaid = findRaidBySlug(groups, 'farming')
  }

  if (suggestedRaid) {
    updateRaidSelectorUI(suggestedRaid)
  }
}

/**
 * Find a raid by slug across all groups
 */
function findRaidBySlug(groups, slug) {
  for (const group of groups) {
    const raid = (group.raids || []).find(r => r.slug === slug)
    if (raid) return { ...raid, group }
  }
  return null
}

// Checkmark SVG for checkboxes
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7139 4.04764C13.14 3.52854 13.0837 2.74594 12.5881 2.29964C12.0925 1.85335 11.3453 1.91237 10.9192 2.43147L5.28565 9.94404L3.02018 7.32366C2.55804 6.83959 1.80875 6.83959 1.34661 7.32366C0.884464 7.80772 0.884464 8.59255 1.34661 9.07662L4.50946 12.6369C4.9716 13.121 5.72089 13.121 6.18303 12.6369C6.2359 12.5816 6.28675 12.5271 6.33575 12.4674L12.7139 4.04764Z"/></svg>`

/**
 * Initialize filter dropdown and checkbox listeners
 */
function initializeFilterListeners() {
  const filterButton = document.getElementById('filterButton')
  const filterDropdown = document.getElementById('filterDropdown')

  // Toggle dropdown on button click
  filterButton?.addEventListener('click', (e) => {
    e.stopPropagation()
    filterDropdown?.classList.toggle('open')
  })

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    filterDropdown?.classList.remove('open')
  })

  // Prevent dropdown from closing when clicking inside it
  filterDropdown?.addEventListener('click', (e) => {
    e.stopPropagation()
  })

  // Rarity checkbox changes (value="4", "3", "2")
  filterDropdown?.querySelectorAll('input[type="checkbox"][value]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateRarityFilter(checkbox.value, checkbox.checked)
    })
  })

  // Lv1 exclusion checkbox
  const excludeLv1Checkbox = document.getElementById('excludeLv1Checkbox')
  excludeLv1Checkbox?.addEventListener('change', () => {
    excludeLv1Items = excludeLv1Checkbox.checked
    refreshDetailViewWithFilters()
  })

  // Full sync checkbox - toggles sync button visibility
  const enableFullSyncCheckbox = document.getElementById('enableFullSyncCheckbox')
  enableFullSyncCheckbox?.addEventListener('change', (e) => {
    const syncBtn = document.getElementById('detailSync')
    if (syncBtn) {
      if (e.target.checked) {
        syncBtn.classList.remove('hidden')
        syncBtn.textContent = 'Full Sync'
        syncBtn.disabled = false
      } else {
        syncBtn.classList.add('hidden')
      }
    }
  })
}

/**
 * Update rarity filter and refresh view
 */
function updateRarityFilter(rarity, isChecked) {
  if (isChecked) {
    activeRarityFilters.add(rarity)
  } else {
    activeRarityFilters.delete(rarity)
  }
  updateFilterButtonLabel()
  refreshDetailViewWithFilters()
}

/**
 * Update the filter button label based on active filters
 */
function updateFilterButtonLabel() {
  const filterButton = document.getElementById('filterButton')
  if (!filterButton) return

  const labelSpan = filterButton.querySelector('span')
  if (!labelSpan) return

  const activeLabels = Array.from(activeRarityFilters)
    .sort((a, b) => parseInt(b) - parseInt(a)) // Sort descending (SSR, SR, R)
    .map(r => RARITY_LABELS[r])
    .filter(Boolean)

  labelSpan.textContent = activeLabels.length > 0 ? activeLabels.join('/') : 'Filter'
}

/**
 * Refresh detail view with current filters applied
 */
async function refreshDetailViewWithFilters() {
  if (!detailViewActive || !currentDetailDataType) return

  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType: currentDetailDataType
  })

  if (response.error) return

  renderDetailItems(currentDetailDataType, response.data)
}

/**
 * Check if an item should be filtered out based on rarity
 */
function shouldFilterByRarity(item, dataType) {
  if (!isWeaponOrSummonCollection(dataType)) return false

  const rarity = item.master?.rarity?.toString() || item.rarity?.toString()
  if (!rarity) return false

  return !activeRarityFilters.has(rarity)
}

/**
 * Check if an item should be filtered out due to Lv1 exclusion
 */
function shouldFilterByLv1(item, dataType) {
  if (!isWeaponOrSummonCollection(dataType)) return false
  if (!excludeLv1Items) return false

  const level = item.param?.level || item.level || item.lv
  return level === 1 || level === '1'
}

/**
 * Summon IDs with alternate art, mapped to the uncap level of their first art upgrade.
 * Matches hensei-svelte's SUMMON_ALT_ART_THRESHOLD.
 */
const SUMMON_ALT_ART_THRESHOLD = new Map([
  ['2040094000', 5], ['2040100000', 5], ['2040080000', 5], ['2040098000', 5],
  ['2040090000', 5], ['2040084000', 5], ['2040003000', 5], ['2040056000', 5], ['2040065000', 5],
  ['2040020000', 4], ['2040034000', 4], ['2040028000', 4], ['2040027000', 4],
  ['2040046000', 4], ['2040047000', 4], ['2040430000', 4]
])

/**
 * Get the max uncap art suffix for a summon based on its uncap flags.
 */
function getMaxSummonSuffix(granblueId, uncap) {
  if (!uncap) return ''
  const threshold = SUMMON_ALT_ART_THRESHOLD.get(String(granblueId))
  if (!threshold) return ''
  if (uncap.transcendence) return '_04'
  if (uncap.ulb) return '_03'
  if (uncap.flb || threshold <= 4) return '_02'
  return ''
}

/**
 * Search for a summon by name using the API
 */
async function searchSummonByName(name) {
  if (!name) return null
  try {
    const apiUrl = await getApiUrl('/search/summons')
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: { query: name } })
    })
    if (!response.ok) return null
    const json = await response.json()
    const results = json.results || []
    const match = results.find(s => s.name?.en === name || s.name?.ja === name)
    if (!match) return null
    match.imageSuffix = getMaxSummonSuffix(match.granblue_id, match.uncap)
    return match
  } catch {
    return null
  }
}

/**
 * Fetch weapon key skill_id → slug mapping from the API.
 * Cached in memory for the session.
 */
let _weaponKeyMapCache = null
async function fetchWeaponKeyMap() {
  if (_weaponKeyMapCache) return _weaponKeyMapCache
  try {
    const apiUrl = await getApiUrl('/weapon_keys/skill_map')
    const response = await fetch(apiUrl)
    if (!response.ok) return null
    _weaponKeyMapCache = await response.json()
    return _weaponKeyMapCache
  } catch {
    return null
  }
}

/**
 * Render items in detail view
 */
async function renderDetailItems(dataType, data) {
  const container = document.getElementById('detailItems')

  // Party gets special sectioned layout
  if (dataType.startsWith('party_')) {
    const friendSummonName = data?.deck?.pc?.damage_info?.summon_name
    const [friendSummon, weaponKeyMap] = await Promise.all([
      searchSummonByName(friendSummonName),
      fetchWeaponKeyMap()
    ])
    renderPartyDetail(container, data, { friendSummon, weaponKeyMap })
    return
  }

  // Database detail items get their own layout
  if (isDatabaseDetailType(dataType)) {
    renderDatabaseDetail(container, dataType, data)
    return
  }

  // Character stats gets its own list layout
  if (dataType === 'character_stats') {
    renderCharacterStatsDetail(container, data)
    return
  }

  const allItems = extractItems(dataType, data)
  const isCollection = isCollectionType(dataType)

  // Apply filters (preserving original indices for selection)
  // Create array of { item, originalIndex } pairs
  const itemsWithIndices = allItems.map((item, index) => ({ item, originalIndex: index }))
    .filter(({ item, originalIndex }) => {
      // Skip items with known broken images
      if (brokenImageIndices.has(originalIndex)) return false
      // Skip items filtered by rarity
      if (shouldFilterByRarity(item, dataType)) return false
      // Skip items filtered by Lv1
      if (shouldFilterByLv1(item, dataType)) return false
      return true
    })

  const hasNames = itemsWithIndices.some(({ item }) => item.name || item.master?.name)

  // For collections, all displayed items start selected unless manually unchecked
  // (error handlers will deselect broken ones)
  if (isCollection) {
    itemsWithIndices.forEach(({ originalIndex }) => {
      if (!manuallyUnchecked.has(originalIndex)) {
        selectedItems.add(originalIndex)
      }
    })
  }

  // Determine ownership ID for each item (game_id for weapons/summons/artifacts, granblue_id for characters)
  const isCharacterType = dataType.includes('npc') || dataType.includes('character')
  const isArtifactType = dataType.includes('artifact')
  const getOwnershipId = (item) => {
    if (isCharacterType) return item.master?.id?.toString() || ''
    if (isArtifactType) return item.id?.toString() || ''
    return item.param?.id?.toString() || ''
  }

  if (hasNames) {
    // List layout with names
    container.innerHTML = `<div class="item-list">
      ${itemsWithIndices.map(({ item, originalIndex }) => {
        const name = item.name || item.master?.name || ''
        const level = item.level || item.lv
        const levelText = level ? ` <span class="list-item-level">Lv.${level}</span>` : ''
        const isChecked = !isCollection || selectedItems.has(originalIndex)
        const checkboxHtml = isCollection ? `
          <label class="item-checkbox${isChecked ? ' checked' : ''}" data-index="${originalIndex}">
            <span class="checkbox-indicator">${CHECK_ICON}</span>
          </label>
        ` : ''
        return `
        <div class="list-item${isCollection ? ' selectable' : ''}" data-index="${originalIndex}" data-ownership-id="${getOwnershipId(item)}">
          <img class="list-item-image" src="${getItemImageUrl(dataType, item)}" alt="">
          <div class="list-item-info">
            <span class="list-item-name">${name}${levelText}</span>
            ${dataType.includes('artifact') ? getArtifactLabels(item) : ''}
          </div>
          ${checkboxHtml}
        </div>
      `}).join('')}
    </div>`
  } else {
    // Grid layout (collection views use square-cells for fixed width)
    const gridClass = getGridClass(dataType)
    const isWeaponType = dataType.includes('weapon')
    container.innerHTML = `<div class="item-grid ${gridClass} square-cells">
      ${itemsWithIndices.map(({ item, originalIndex }) => {
        const isChecked = !isCollection || selectedItems.has(originalIndex)
        const checkboxHtml = isCollection ? `
          <label class="item-checkbox${isChecked ? ' checked' : ''}" data-index="${originalIndex}">
            <span class="checkbox-indicator">${CHECK_ICON}</span>
          </label>
        ` : ''
        const modifiersHtml = isCharacterType
          ? renderCharacterModifiers(item)
          : isWeaponType ? renderWeaponModifiers(item) : ''
        return `
        <div class="grid-item${isCollection ? ' selectable' : ''}" data-index="${originalIndex}" data-ownership-id="${getOwnershipId(item)}">
          ${modifiersHtml}
          <img src="${getItemImageUrl(dataType, item)}" alt="">
          ${checkboxHtml}
        </div>
      `}).join('')}
    </div>`
  }

  // Add click handlers for selectable items (whole item toggles checkbox)
  if (isCollection) {
    container.querySelectorAll('.selectable').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index, 10)
        const checkbox = item.querySelector('.item-checkbox')
        if (checkbox) {
          toggleItemSelection(index, checkbox)
        }
      })
    })

    // Hide items when their image fails to load, trying fallback first
    container.querySelectorAll('.selectable img').forEach(img => {
      img.addEventListener('error', () => {
        // Try fallback: remove element suffix (e.g., _0.jpg -> .jpg) before hiding
        const fallbackSrc = img.src.replace(/_\d+\.jpg$/, '.jpg')
        if (img.src !== fallbackSrc && !img.dataset.fallbackAttempted) {
          img.dataset.fallbackAttempted = 'true'
          img.src = fallbackSrc
          return
        }

        const item = img.closest('.selectable')
        if (!item) return
        const index = parseInt(item.dataset.index, 10)
        // Track broken image and hide the item
        brokenImageIndices.add(index)
        selectedItems.delete(index)
        item.style.display = 'none'
        updateSelectionCount()
      })
    })

    updateSelectionCount()
  }

  // Async: dim items already in the user's collection
  if (isCollection) {
    applyOwnershipDimming(container, dataType)
  }
}

/**
 * Fetch collection IDs and dim items already owned
 */
async function applyOwnershipDimming(container, dataType) {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCollectionIds' })
    if (response?.error) return

    // Determine which ID set to check against
    const isCharacterType = dataType.includes('npc') || dataType.includes('character')
    let ownedIds
    if (dataType.includes('weapon') || dataType.startsWith('stash_weapon')) {
      ownedIds = new Set(response.weapons || [])
    } else if (dataType.includes('summon') || dataType.startsWith('stash_summon')) {
      ownedIds = new Set(response.summons || [])
    } else if (dataType.includes('artifact')) {
      ownedIds = new Set(response.artifacts || [])
    } else if (isCharacterType) {
      ownedIds = new Set(response.characters || [])
    } else {
      return
    }

    container.querySelectorAll('[data-ownership-id]').forEach(el => {
      const id = el.dataset.ownershipId
      if (id && ownedIds.has(id)) {
        el.classList.add('owned')
      }
    })
  } catch {
    // Not logged in or API error — skip silently
  }
}

/**
 * Toggle item selection
 */
function toggleItemSelection(index, checkbox) {
  if (selectedItems.has(index)) {
    selectedItems.delete(index)
    manuallyUnchecked.add(index) // Track manual unchecking
    checkbox.classList.remove('checked')
  } else {
    selectedItems.add(index)
    manuallyUnchecked.delete(index) // Clear manual uncheck if re-checked
    checkbox.classList.add('checked')
  }
  updateSelectionCount()
}

/**
 * Update the selection count in the header
 */
function updateSelectionCount() {
  const countEl = document.getElementById('detailItemCount')
  if (countEl && isCollectionType(currentDetailDataType)) {
    // Count only items currently visible in the DOM (respecting filters)
    const checkboxes = document.querySelectorAll('#detailItems .item-checkbox')
    const total = checkboxes.length
    // Count selected items that are currently visible
    let selected = 0
    checkboxes.forEach(checkbox => {
      const index = parseInt(checkbox.dataset.index, 10)
      if (selectedItems.has(index)) selected++
    })
    countEl.textContent = `${selected}/${total} selected`
  }
}

/**
 * Convert object or array to array (handles GBF's inconsistent data formats)
 */
/**
 * Render character stats detail view
 */
// Track the last render timestamp for character stats to detect new items
let lastCharacterStatsRenderTime = 0

function renderCharacterStatsDetail(container, data) {
  // Data is keyed by masterId
  let characters = Object.values(data)

  if (characters.length === 0) {
    container.innerHTML = '<p class="cache-empty">No character stats captured</p>'
    return
  }

  // Sort by timestamp descending (most recent first)
  characters = characters.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  // Determine which items are "new" (added since last render)
  const renderTime = Date.now()
  const newThreshold = lastCharacterStatsRenderTime || 0

  // Initialize all items as selected
  selectedItems = new Set(characters.map((_, i) => i))

  let html = '<div class="char-stats-list">'

  characters.forEach((char, index) => {
    const masterId = char.masterId
    const name = char.masterName || `Character ${masterId}`
    const imageUrl = getImageUrl(`character-square/${masterId}_01.jpg`)

    // Element label
    const elementHtml = char.element && GAME_ELEMENT_NAMES[char.element]
      ? `<img class="char-stats-element" src="${getImageUrl(`labels/element/Label_Element_${GAME_ELEMENT_NAMES[char.element]}.png`)}" alt="${GAME_ELEMENT_NAMES[char.element]}">`
      : ''

    // Awakening line
    const awakeningHtml = char.awakening
      ? `<div class="char-stats-awakening">${char.awakening.typeName || 'Awakening'} Lv.${char.awakening.level || 1}${char.perpetuity ? ' · Perpetuity Ring' : ''}</div>`
      : (char.perpetuity ? '<div class="char-stats-awakening">Perpetuity Ring</div>' : '')

    // Over Mastery (rings) section
    let overMasteryHtml = ''
    if (char.rings && char.rings.length > 0) {
      overMasteryHtml = '<div class="char-stats-section"><div class="char-stats-subheader">Over Mastery</div>'
      for (const ring of char.rings) {
        const ringStr = formatModifier(ring, OVER_MASTERY_NAMES)
        if (ringStr) {
          overMasteryHtml += `<div class="char-stats-line">${ringStr}</div>`
        }
      }
      overMasteryHtml += '</div>'
    }

    // Aetherial Mastery (earring) section
    let aetherialHtml = ''
    if (char.earring) {
      const earringStr = formatModifier(char.earring, AETHERIAL_NAMES)
      if (earringStr) {
        aetherialHtml = `<div class="char-stats-section"><div class="char-stats-subheader">Aetherial Mastery</div><div class="char-stats-line">${earringStr}</div></div>`
      }
    }

    // Perpetuity Ring bonuses section
    let perpetuityHtml = ''
    if (char.perpetuityBonuses && char.perpetuityBonuses.length > 0) {
      perpetuityHtml = '<div class="char-stats-section"><div class="char-stats-subheader">Perpetuity Bonuses</div>'
      for (const bonus of char.perpetuityBonuses) {
        const bonusStr = formatPerpetuityBonus(bonus)
        if (bonusStr) {
          perpetuityHtml += `<div class="char-stats-line">${bonusStr}</div>`
        }
      }
      perpetuityHtml += '</div>'
    }

    // Check if we have any stats to show
    const hasStats = char.awakening || char.perpetuity || (char.rings && char.rings.length > 0) || char.earring || (char.perpetuityBonuses && char.perpetuityBonuses.length > 0)
    const noStatsHtml = !hasStats ? '<div class="char-stats-empty">No stats captured</div>' : ''

    // Perpetuity icon overlay on character image
    const perpetuityIconHtml = char.perpetuity
      ? `<img class="char-stats-perpetuity" src="icons/perpetuity/filled.svg" alt="Perpetuity Ring" title="Perpetuity Ring">`
      : ''

    // Check if this item is new (added/updated since last render)
    const isNew = char.timestamp && char.timestamp > newThreshold
    const newClass = isNew ? ' new-item' : ''

    html += `
      <div class="char-stats-item selectable${newClass}" data-index="${index}" data-master-id="${masterId}">
        <div class="char-stats-header">
          <label class="item-checkbox checked" data-index="${index}">
            <span class="checkbox-indicator">${CHECK_ICON}</span>
          </label>
          <div class="char-stats-name-row">
            <span class="char-stats-name">${name}</span>
            ${elementHtml}
          </div>
          <div class="char-stats-image-wrapper">
            <img class="char-stats-image" src="${imageUrl}" alt="">
            ${perpetuityIconHtml}
          </div>
        </div>
        <div class="char-stats-body">
          ${awakeningHtml}
          ${overMasteryHtml}
          ${aetherialHtml}
          ${perpetuityHtml}
          ${noStatsHtml}
        </div>
      </div>
    `
  })

  html += '</div>'
  container.innerHTML = html

  // Add click handlers for checkboxes only (not entire item since it's larger now)
  container.querySelectorAll('.item-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation()
      const index = parseInt(checkbox.dataset.index, 10)
      toggleItemSelection(index, checkbox)
    })
  })

  // Uncheck items when their image fails to load
  container.querySelectorAll('.char-stats-image').forEach(img => {
    img.addEventListener('error', () => {
      const item = img.closest('.char-stats-item')
      if (!item) return
      const index = parseInt(item.dataset.index, 10)
      const checkbox = item.querySelector('.item-checkbox')
      if (checkbox && selectedItems.has(index)) {
        selectedItems.delete(index)
        checkbox.classList.remove('checked')
        updateSelectionCount()
      }
    })
  })

  // Update last render time for detecting new items on next render
  lastCharacterStatsRenderTime = renderTime
}

/**
 * Filter collection data to only include selected items
 */
function filterSelectedItems(dataType, data) {
  if (!isCollectionType(dataType)) return data

  // Character stats is keyed by masterId, not paginated
  if (dataType === 'character_stats') {
    const characters = Object.values(data)
    const result = {}
    characters.forEach((char, index) => {
      if (selectedItems.has(index)) {
        result[char.masterId] = char
      }
    })
    return result
  }

  const items = extractItems(dataType, data)
  const filteredItems = items.filter((_, i) => selectedItems.has(i))

  // Reconstruct the data structure with filtered items
  // Collection data is an object keyed by page number, each with a 'list' array
  const result = {}
  let itemIndex = 0

  for (const [pageNum, pageData] of Object.entries(data)) {
    const pageItems = pageData.list || []
    const filteredPageItems = []

    for (const item of pageItems) {
      if (selectedItems.has(itemIndex)) {
        filteredPageItems.push(item)
      }
      itemIndex++
    }

    if (filteredPageItems.length > 0) {
      result[pageNum] = { ...pageData, list: filteredPageItems }
    }
  }

  return result
}

/**
 * Handle copy from detail view
 */
async function handleDetailCopy() {
  if (!currentDetailDataType) return

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast('Failed to copy')
      return
    }

    // Filter to selected items for collections
    const dataToExport = filterSelectedItems(currentDetailDataType, response.data)

    const jsonString = JSON.stringify(dataToExport, null, 2)
    await navigator.clipboard.writeText(jsonString)

    if (isCollectionType(currentDetailDataType)) {
      showToast(`Copied ${selectedItems.size} items`)
    } else {
      showToast('Copied to clipboard')
    }
  } catch (error) {
    showToast('Failed to copy')
  }
}

/**
 * Handle save/download from detail view
 */
async function handleDetailSave() {
  if (!currentDetailDataType) return

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast('Failed to save')
      return
    }

    const dataToExport = filterSelectedItems(currentDetailDataType, response.data)
    const jsonString = JSON.stringify(dataToExport, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentDetailDataType}.json`
    a.click()
    URL.revokeObjectURL(url)

    showToast(`Saved ${currentDetailDataType}.json`)
  } catch (error) {
    showToast('Failed to save')
  }
}

/**
 * Handle Review button click — open the conflict resolution modal
 */
function handleDetailReview() {
  if (!pendingConflicts || pendingConflicts.length === 0) return

  showConflictModal(pendingConflicts, currentDetailDataType, (decisions) => {
    // Convert Map to plain object for serialization
    conflictResolutions = {}
    for (const [gameId, decision] of decisions) {
      conflictResolutions[gameId] = decision
    }

    // Hide the review button since user has resolved
    const reviewBtn = document.getElementById('detailReview')
    if (reviewBtn) {
      reviewBtn.textContent = 'Reviewed'
      reviewBtn.classList.add('imported')
    }
  })
}

/**
 * Check if this is a weapon/summon collection type that supports conflict checking
 */
function supportsConflictCheck(dataType) {
  return dataType === 'collection_weapon' || dataType === 'collection_summon' ||
         dataType === 'list_weapon' || dataType === 'list_summon' ||
         dataType?.startsWith('stash_weapon') || dataType?.startsWith('stash_summon')
}

/**
 * Handle import from detail view
 */
async function handleDetailImport() {
  if (!currentDetailDataType) return

  const importBtn = document.getElementById('detailImport')
  if (importBtn) {
    importBtn.disabled = true
    importBtn.textContent = 'Importing...'
  }

  try {
    // Get cached data
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast('Import failed')
      return
    }

    // Filter to selected items for collections
    const dataToUpload = filterSelectedItems(currentDetailDataType, response.data)

    // For weapon/summon collections, check for conflicts on first import attempt
    if (supportsConflictCheck(currentDetailDataType) && !conflictResolutions && !pendingConflicts) {
      importBtn.textContent = 'Checking...'

      const conflictResponse = await chrome.runtime.sendMessage({
        action: 'checkConflicts',
        data: dataToUpload,
        dataType: currentDetailDataType
      })

      if (!conflictResponse.error && conflictResponse.conflicts?.length > 0) {
        // Conflicts found — show Review button and pause import
        pendingConflicts = conflictResponse.conflicts
        const reviewBtn = document.getElementById('detailReview')
        if (reviewBtn) {
          reviewBtn.textContent = `Review (${pendingConflicts.length})`
          reviewBtn.classList.remove('hidden')
        }
        showToast(`${pendingConflicts.length} item${pendingConflicts.length > 1 ? 's' : ''} need review`)
        return
      }
      // No conflicts — proceed normally
    }

    // If there are unresolved conflicts, prompt user to review first
    if (pendingConflicts && !conflictResolutions) {
      showToast('Review conflicts before importing')
      return
    }

    // Upload based on data type
    let uploadResponse
    if (currentDetailDataType.startsWith('party_')) {
      const raid = getSelectedRaid()
      const playlists = getSelectedPlaylists()
      const partyName = document.getElementById('partyNameInput')?.value?.trim() || null
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadPartyData',
        data: dataToUpload,
        raidId: raid?.id || null,
        playlistIds: playlists.map(p => p.id),
        name: partyName
      })
    } else if (currentDetailDataType.startsWith('detail_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadDetailData',
        data: dataToUpload,
        dataType: currentDetailDataType
      })
    } else if (currentDetailDataType.startsWith('collection_') || currentDetailDataType.startsWith('list_') || currentDetailDataType.startsWith('stash_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadCollectionData',
        data: dataToUpload,
        dataType: currentDetailDataType,
        updateExisting: currentDetailDataType === 'collection_artifact',
        conflictResolutions: conflictResolutions || undefined
      })
    } else if (currentDetailDataType === 'character_stats') {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadCharacterStats',
        data: dataToUpload
      })
    } else {
      showToast('Import not supported')
      return
    }

    if (uploadResponse.error) {
      showToast(uploadResponse.error)
    } else if (uploadResponse.url) {
      // Party import - opens in new tab
      chrome.tabs.create({ url: uploadResponse.url })
      showToast('Opening party...')
    } else if (uploadResponse.created !== undefined) {
      // Collection import
      const total = uploadResponse.created + uploadResponse.updated
      showToast(`Imported ${total} items`)
      if (importBtn) {
        importBtn.textContent = 'Imported'
        importBtn.classList.add('imported')
      }
    } else {
      showToast('Import successful')
      if (importBtn) {
        importBtn.textContent = 'Imported'
        importBtn.classList.add('imported')
      }
    }
  } catch (error) {
    showToast('Import failed')
  } finally {
    if (importBtn && !importBtn.classList.contains('imported')) {
      importBtn.disabled = false
      importBtn.textContent = 'Import'
    }
  }
}

// ==========================================
// AUTHENTICATION
// ==========================================

/**
 * Handle login button click
 */
async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim()
  const password = document.getElementById('loginPassword').value.trim()
  const loginButton = document.getElementById('loginButton')
  const loginStatus = document.getElementById('loginStatus')

  if (!username || !password) {
    showStatus(loginStatus, 'Please enter username and password', 'error')
    return
  }

  loginButton.disabled = true
  showStatus(loginStatus, 'Logging in...', 'info')

  try {
    // Perform login
    let gbAuth = await performLogin(username, password)

    // Fetch additional user info (including role for permissions)
    const userInfo = await fetchUserInfo(gbAuth.access_token)
    gbAuth = {
      ...gbAuth,
      avatar: userInfo.avatar,
      language: userInfo.language,
      role: userInfo.role || 0
    }

    // Only save auth after both steps succeed
    await chrome.storage.local.set({ gbAuth })

    showStatus(loginStatus, 'Login successful!', 'success')

    // Switch to main view after brief delay
    setTimeout(() => {
      initializeApp()
    }, 1000)

  } catch (err) {
    console.error('Login error:', err)
    showStatus(loginStatus, err.message || 'Login failed', 'error')
    loginButton.disabled = false
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  stopAgeTicker()
  await chrome.storage.local.remove(['gbAuth'])
  clearElementColors(document.body)
  initializeApp()
}

/**
 * Handle show warning/disclaimer
 */
function handleShowWarning() {
  const loginView = document.getElementById('loginView')
  const mainView = document.getElementById('mainView')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  // Show warning in login view, hide main view
  show(loginView)
  hide(mainView)
  show(warning)
  hide(loginFormContainer)

  // Update acknowledge button to return to main view instead of showing login
  const acknowledgeButton = document.getElementById('acknowledgeButton')
  acknowledgeButton.onclick = () => {
    hide(loginView)
    show(mainView)
    // Reset the button for normal login flow
    acknowledgeButton.onclick = null
    initializeLoginListeners()
  }
}

// ==========================================
// PROFILE UI
// ==========================================

/**
 * Update profile UI with user data
 */
async function updateProfileUI(gbAuth) {
  const tabAvatar = document.getElementById('tabAvatar')
  const profileAvatar = document.getElementById('profileAvatar')
  const profileUsername = document.getElementById('profileUsername')
  const profileHeader = document.getElementById('viewProfile')

  // Update username
  if (profileUsername) {
    profileUsername.textContent = gbAuth.user?.username || 'User'
  }

  // Update avatars
  const avatarUrl = gbAuth.avatar?.picture
    ? getImageUrl(`profile/${gbAuth.avatar.picture}@2x.png`)
    : getImageUrl('profile/npc@2x.png')

  if (tabAvatar) tabAvatar.src = avatarUrl
  if (profileAvatar) profileAvatar.src = avatarUrl

  // Set element color on body
  if (gbAuth.avatar?.element) {
    setElementColor(document.body, gbAuth.avatar.element)
  }

  // Update profile link
  if (profileHeader && gbAuth.user?.username) {
    const siteUrl = await getSiteBaseUrl()
    profileHeader.href = `${siteUrl}/${gbAuth.user.username}`
  }
}

// ==========================================
// AGE TICKER
// ==========================================

/**
 * Start the age ticker interval
 */
function startAgeTicker() {
  stopAgeTicker()
  ageTickerInterval = setInterval(updateAgeDisplays, 1000)
}

/**
 * Stop the age ticker interval
 */
function stopAgeTicker() {
  if (ageTickerInterval) {
    clearInterval(ageTickerInterval)
    ageTickerInterval = null
  }
}

/**
 * Update all age displays with current time
 */
function updateAgeDisplays() {
  // Update detail view freshness
  if (detailViewActive && currentDetailDataType && cachedStatus?.[currentDetailDataType]) {
    const status = cachedStatus[currentDetailDataType]
    if (status.lastUpdated) {
      const age = Date.now() - status.lastUpdated
      document.getElementById('detailFreshness').textContent = formatAge(age)
    }
  }

  // Update list view cache ages
  document.querySelectorAll('.cache-item[data-type]').forEach(item => {
    const dataType = item.dataset.type
    const status = cachedStatus?.[dataType]
    if (status?.lastUpdated) {
      const age = Date.now() - status.lastUpdated
      const ageEl = item.querySelector('.cache-age')
      if (ageEl) ageEl.textContent = formatAge(age)
    }
  })
}

// ==========================================
// CACHE MANAGEMENT
// ==========================================

/**
 * Refresh cache status for all tabs
 */
async function refreshAllCaches() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCacheStatus' })

    if (response?.error) {
      console.error('Cache status error:', response.error)
      cachedStatus = {}
    } else {
      cachedStatus = formatCacheStatus(response || {})
    }
  } catch (error) {
    console.error('Error refreshing cache:', error)
    cachedStatus = {}
  }

  // Always update all data tabs
  updateTabCacheDisplay('party', cachedStatus)
  updateTabCacheDisplay('collection', cachedStatus)
  updateTabCacheDisplay('database', cachedStatus)
}

/**
 * Update cache display for a specific tab
 */
function updateTabCacheDisplay(tabName, status) {
  const container = document.getElementById(`${tabName}Items`)
  if (!container) return

  // Get types to display - party and database tabs discover dynamically from status
  let typesToDisplay = []
  if (tabName === 'party') {
    // Find all party_* types in status
    typesToDisplay = Object.keys(status || {})
      .filter(type => type.startsWith('party_') && status[type]?.available)
  } else if (tabName === 'database') {
    // Find all detail_*_* types in status (per-item, like parties)
    typesToDisplay = Object.keys(status || {})
      .filter(type =>
        (type.startsWith('detail_npc_') ||
         type.startsWith('detail_weapon_') ||
         type.startsWith('detail_summon_')) &&
        status[type]?.available
      )
  } else {
    typesToDisplay = (TAB_DATA_TYPES[tabName] || [])
      .filter(type => status?.[type]?.available)
    // Discover dynamic stash types for the collection tab
    if (tabName === 'collection') {
      const stashTypes = Object.keys(status || {})
        .filter(type =>
          (type.startsWith('stash_weapon_') || type.startsWith('stash_summon_')) &&
          status[type]?.available
        )
      typesToDisplay.push(...stashTypes)
    }
  }

  // Sort by lastUpdated descending (most recent first)
  typesToDisplay.sort((a, b) => {
    const aTime = status[a]?.lastUpdated || 0
    const bTime = status[b]?.lastUpdated || 0
    return bTime - aTime
  })

  if (typesToDisplay.length === 0) {
    container.innerHTML = `<p class="cache-empty">${getEmptyMessage(tabName)}</p>`
    return
  }

  let html = ''

  for (const type of typesToDisplay) {
    const info = status[type]
    if (!info?.available) continue

    // Use partyName for parties, displayName for others
    const displayName = info.partyName || info.displayName

    const subtitleHtml = info.subtitle
      ? `<span class="cache-subtitle">${info.subtitle}</span>`
      : ''

    html += `
      <div class="cache-item ${info.statusClass}" data-type="${type}" data-tab="${tabName}">
        <div class="cache-info">
          <span class="cache-name">${displayName}</span>
          ${subtitleHtml}
        </div>
        <div class="cache-right">
          <span class="cache-age">${info.ageText}</span>
          <button class="cache-detail-btn" data-type="${type}" aria-label="View details">
            <svg class="icon-chevron" viewBox="0 0 14 14" fill="currentColor">
              <path d="M4.17094 2.04309C4.56138 1.6528 5.1945 1.6529 5.585 2.04309L9.82719 6.28625C9.9998 6.45893 10.0963 6.67885 10.1162 6.90442C10.1436 7.19118 10.0468 7.48755 9.82719 7.70715L5.585 11.9503C5.19455 12.3402 4.56133 12.3403 4.17094 11.9503C3.78079 11.5599 3.78097 10.9267 4.17094 10.5363L7.70902 6.99622L4.17094 3.45715C3.78082 3.06673 3.78088 2.43355 4.17094 2.04309Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `
  }

  container.innerHTML = html

  // Add click handlers for rows - open detail view
  container.querySelectorAll('.cache-item[data-type]').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('stale')) return
      showDetailView(item.dataset.type)
    })
  })
}

/**
 * Get empty message for a tab
 */
function getEmptyMessage(tabName) {
  switch (tabName) {
    case 'party': return 'Browse a party in game to capture data'
    case 'collection': return 'Browse your collection pages to capture data'
    case 'database': return 'Browse detail pages to capture data'
    default: return 'No data available'
  }
}

/**
 * Handle clear cache
 */
async function handleClearCache() {
  await chrome.runtime.sendMessage({ action: 'clearCache' })
  selectedDataTypes = { party: null, collection: null, database: null }
  cachedStatus = null

  // Reset all tab displays
  for (const tabName of ['party', 'collection', 'database']) {
    const container = document.getElementById(`${tabName}Items`)
    if (container) {
      container.innerHTML = `<p class="cache-empty">${getEmptyMessage(tabName)}</p>`
    }
  }

  showTabStatus(activeTab, 'Cache cleared', 'info')
  setTimeout(() => hideTabStatus(activeTab), 2000)
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

/**
 * Handle messages from content script / background
 */
async function handleMessages(message) {
  if (message.action === 'dataCaptured') {
    // Refresh cache status
    await refreshAllCaches()

    // Switch to the appropriate tab and show notification
    const tabName = getTabForDataType(message.dataType)
    if (tabName) {
      if (activeTab !== tabName) {
        switchTab(tabName)
      }
      showTabStatus(tabName, `${getDataTypeName(message.dataType)} data captured!`, 'success')
      setTimeout(() => hideTabStatus(tabName), 2000)
    }

    // Refresh detail view if it's currently showing the same data type
    if (detailViewActive && currentDetailDataType) {
      if (message.dataType === currentDetailDataType) {
        refreshDetailView()
      }
    }
  }
}

/**
 * Refresh the current detail view with latest data
 */
async function refreshDetailView() {
  if (!currentDetailDataType) return

  const response = await chrome.runtime.sendMessage({
    action: 'getCachedData',
    dataType: currentDetailDataType
  })

  if (response.error) {
    return
  }

  // Update freshness text
  const status = cachedStatus[currentDetailDataType]
  if (status) {
    document.getElementById('detailFreshness').textContent = status.ageText
  }

  // Update item count
  if (currentDetailDataType === 'character_stats') {
    const count = Object.keys(response.data).length
    document.getElementById('detailItemCount').textContent = `${count} characters`
  }

  // Count existing items before re-render (for scroll-to-new behavior)
  const container = document.getElementById('detailItems')
  const oldItemCount = container.querySelectorAll('.grid-item, .list-item, .char-stats-item').length

  // Re-render detail items
  renderDetailItems(currentDetailDataType, response.data)

  // Scroll to show new items if count increased
  const newItems = container.querySelectorAll('.grid-item, .list-item, .char-stats-item')
  if (newItems.length > oldItemCount && oldItemCount > 0) {
    // For character stats (sorted newest first), scroll to top
    if (currentDetailDataType === 'character_stats') {
      container.scrollTop = 0
    } else {
      // For list pages (appended at end), scroll to first new item
      const firstNewItem = newItems[oldItemCount]
      if (firstNewItem) {
        firstNewItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }
}

/**
 * Get which tab a data type belongs to
 */
function getTabForDataType(dataType) {
  // Party types are dynamic, not in TAB_DATA_TYPES
  if (dataType.startsWith('party_')) {
    return 'party'
  }
  // Stash types are dynamic (per-stash entries)
  if (dataType.startsWith('stash_')) {
    return 'collection'
  }
  for (const [tab, types] of Object.entries(TAB_DATA_TYPES)) {
    if (types.includes(dataType)) return tab
  }
  return null
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Show status message in a tab
 */
function showTabStatus(tabName, message, type = 'info') {
  const notice = document.getElementById(`${tabName}Notice`)
  const status = document.getElementById(`${tabName}Status`)

  if (notice && status) {
    notice.classList.remove('hidden')
    notice.className = `notice status-${type}`
    status.textContent = message
  }
}

/**
 * Hide status message in a tab
 */
function hideTabStatus(tabName) {
  const notice = document.getElementById(`${tabName}Notice`)
  if (notice) {
    notice.classList.add('hidden')
  }
}

/**
 * Show status message in an element
 */
function showStatus(element, message, type = 'info') {
  if (!element) return
  element.textContent = message
  element.className = `status-${type}`
  show(element)
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Show a toast message
 */
let toastTimeout = null
function showToast(message) {
  const toast = document.getElementById('toast')
  if (!toast) return

  // Clear any existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout)
  }

  toast.textContent = message
  toast.classList.add('visible')

  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible')
  }, 2500)
}

/**
 * Check if the extension is outdated and show a banner if so
 */
async function checkForUpdate() {
  const response = await chrome.runtime.sendMessage({ action: 'checkExtensionVersion' })
  if (response?.isOutdated) {
    const banner = document.getElementById('updateBanner')
    const versionSpan = document.getElementById('updateVersion')
    if (!banner || !versionSpan) return
    versionSpan.textContent = response.latest
    banner.classList.remove('hidden')
  }
}
