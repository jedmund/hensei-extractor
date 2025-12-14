/**
 * @fileoverview Popup script for the Granblue Fantasy Chrome extension.
 * Handles tab navigation, authentication, and data operations.
 */

import { performLogin, fetchUserInfo } from "./auth.js"
import { formatCacheStatus } from "./cache.js"
import {
  getDataTypeName,
  TAB_DATA_TYPES,
  getImageUrl,
  getSiteBaseUrl
} from "./constants.js"
import {
  show,
  hide,
  setElementColor,
  clearElementColors
} from "./dom.js"

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

  // Profile actions
  document.getElementById('logoutButton')?.addEventListener('click', handleLogout)
  document.getElementById('clearCacheButton')?.addEventListener('click', handleClearCache)
  document.getElementById('showWarning')?.addEventListener('click', handleShowWarning)

  // Detail view buttons
  document.getElementById('detailBack')?.addEventListener('click', hideDetailView)
  document.getElementById('detailCopy')?.addEventListener('click', handleDetailCopy)
  document.getElementById('detailImport')?.addEventListener('click', handleDetailImport)
}

// ==========================================
// TAB NAVIGATION
// ==========================================

/**
 * Switch to a different tab
 */
function switchTab(tabName) {
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

  if (dataType === 'party') {
    // Party shows section counts
    // Characters are at deck.npc, weapons/summons are at deck.pc
    const deck = response.data.deck || {}
    const pc = deck.pc || {}
    const chars = toArray(deck.npc).filter(Boolean).length
    const wpns = toArray(pc.weapons).filter(Boolean).length
    const sums = toArray(pc.summons).filter(Boolean).length
    document.getElementById('detailPageCount').textContent = ''
    document.getElementById('detailItemCount').textContent = `${chars} characters · ${wpns} weapons · ${sums} summons`
  } else {
    document.getElementById('detailPageCount').textContent = status.pageCount ? `${status.pageCount} pages` : ''
    document.getElementById('detailItemCount').textContent = `${status.totalItems || countItems(dataType, response.data)} items`
  }

  // Reset import button
  const importBtn = document.getElementById('detailImport')
  importBtn.textContent = 'Import'
  importBtn.disabled = false
  importBtn.classList.remove('imported')

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
}

/**
 * Count items in data
 */
function countItems(dataType, data) {
  const items = extractItems(dataType, data)
  return items.length
}

/**
 * Render items in detail view
 */
function renderDetailItems(dataType, data) {
  const container = document.getElementById('detailItems')

  // Party gets special sectioned layout
  if (dataType === 'party') {
    renderPartyDetail(container, data)
    return
  }

  const items = extractItems(dataType, data)
  const hasNames = items.some(item => item.name || item.master?.name)

  if (hasNames) {
    // List layout with names
    container.innerHTML = `<div class="item-list">
      ${items.map(item => `
        <div class="list-item">
          <img class="list-item-image" src="${getItemImageUrl(dataType, item)}" alt="">
          <span class="list-item-name">${item.name || item.master?.name || ''}</span>
        </div>
      `).join('')}
    </div>`
  } else {
    // Grid layout
    const gridClass = getGridClass(dataType)
    container.innerHTML = `<div class="item-grid ${gridClass}">
      ${items.map(item => `
        <div class="grid-item">
          <img src="${getItemImageUrl(dataType, item)}" alt="">
        </div>
      `).join('')}
    </div>`
  }
}

/**
 * Convert object or array to array (handles GBF's inconsistent data formats)
 */
function toArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  return Object.values(data)
}

/**
 * Render party detail with sections for characters, weapons, summons
 */
function renderPartyDetail(container, data) {
  // Characters are at deck.npc, weapons/summons are at deck.pc
  const deck = data.deck || {}
  const pc = deck.pc || {}
  const characters = toArray(deck.npc).filter(Boolean)
  const weapons = toArray(pc.weapons).filter(Boolean)
  const summons = toArray(pc.summons).filter(Boolean)

  let html = ''

  // Characters section
  if (characters.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">Characters</h3>
        <div class="item-grid characters">
          ${characters.map(item => `
            <div class="grid-item">
              <img src="${getItemImageUrl('npc', item)}" alt="">
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  // Weapons section
  if (weapons.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">Weapons</h3>
        <div class="item-grid weapons">
          ${weapons.map(item => `
            <div class="grid-item">
              <img src="${getItemImageUrl('weapon', item)}" alt="">
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  // Summons section
  if (summons.length > 0) {
    html += `
      <div class="party-section">
        <h3 class="party-section-title">Summons</h3>
        <div class="item-grid summons">
          ${summons.map(item => `
            <div class="grid-item">
              <img src="${getItemImageUrl('summon', item)}" alt="">
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  container.innerHTML = html || '<p class="cache-empty">No party data</p>'
}

/**
 * Extract items from data based on type
 */
function extractItems(dataType, data) {
  if (dataType.startsWith('collection_') || dataType.startsWith('list_')) {
    // Paginated collection - data.pages is an object keyed by page number
    const pages = Object.values(data)
    return pages.flatMap(page => page.list || [])
  }
  if (dataType === 'party') {
    // Characters are at deck.npc, weapons/summons are at deck.pc
    const deck = data.deck || {}
    const pc = deck.pc || {}
    return [
      ...toArray(deck.npc),
      ...toArray(pc.weapons),
      ...toArray(pc.summons)
    ].filter(Boolean)
  }
  // Single detail item
  return [data]
}

/**
 * Get image URL for an item using siero-img S3 CDN
 */
function getItemImageUrl(dataType, item) {
  const granblueId = item.master?.id || item.param?.id || item.id

  // Use square images for detail view
  if (dataType.includes('npc') || dataType.includes('character')) {
    return getImageUrl(`character-square/${granblueId}_01.jpg`)
  }
  if (dataType.includes('weapon')) {
    return getImageUrl(`weapon-square/${granblueId}.jpg`)
  }
  if (dataType.includes('summon')) {
    return getImageUrl(`summon-square/${granblueId}.jpg`)
  }
  if (dataType.includes('artifact')) {
    return getImageUrl(`artifact-square/${granblueId}.jpg`)
  }
  return ''
}

/**
 * Get grid class based on data type
 */
function getGridClass(dataType) {
  if (dataType.includes('artifact')) return 'artifacts'
  if (dataType.includes('npc') || dataType.includes('character')) return 'characters'
  if (dataType.includes('weapon')) return 'weapons'
  if (dataType.includes('summon')) return 'summons'
  return ''
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

    const jsonString = JSON.stringify(response.data, null, 2)
    await navigator.clipboard.writeText(jsonString)
    showToast('Copied to clipboard')
  } catch (error) {
    showToast('Failed to copy')
  }
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

    // Upload based on data type
    let uploadResponse
    if (currentDetailDataType === 'party') {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadPartyData',
        data: response.data
      })
    } else if (currentDetailDataType.startsWith('detail_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadDetailData',
        data: response.data,
        dataType: currentDetailDataType
      })
    } else if (currentDetailDataType.startsWith('collection_') || currentDetailDataType.startsWith('list_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadCollectionData',
        data: response.data,
        dataType: currentDetailDataType,
        updateExisting: false
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

  const allowedTypes = TAB_DATA_TYPES[tabName] || []
  const hasData = status && allowedTypes.some(type => status[type]?.available)

  if (!hasData) {
    container.innerHTML = `<p class="cache-empty">${getEmptyMessage(tabName)}</p>`
    return
  }

  let html = ''

  for (const type of allowedTypes) {
    const info = status[type]
    if (!info?.available) continue

    const subtitleHtml = info.subtitle
      ? `<span class="cache-subtitle">${info.subtitle}</span>`
      : ''

    html += `
      <div class="cache-item ${info.statusClass}" data-type="${type}" data-tab="${tabName}">
        <div class="cache-info">
          <span class="cache-name">${info.displayName}</span>
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
// DATA OPERATIONS
// ==========================================

/**
 * Handle export for a tab
 */
async function handleExport(tabName) {
  const dataType = selectedDataTypes[tabName]
  if (!dataType) {
    showTabStatus(tabName, 'Please select data to export', 'error')
    return
  }

  const exportBtn = document.getElementById(`export${capitalize(tabName)}`)
  if (exportBtn) exportBtn.disabled = true

  showTabStatus(tabName, 'Preparing export...', 'info')

  try {
    // Get cached data
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType
    })

    if (response.error) {
      showTabStatus(tabName, response.error, 'error')
      return
    }

    // Upload based on data type
    let uploadResponse
    if (dataType === 'party') {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadPartyData',
        data: response.data
      })
    } else if (dataType.startsWith('detail_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadDetailData',
        data: response.data,
        dataType
      })
    } else if (dataType.startsWith('collection_') || dataType.startsWith('list_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadCollectionData',
        data: response.data,
        dataType,
        updateExisting: false
      })
    } else {
      showTabStatus(tabName, 'Export not supported for this data type', 'error')
      return
    }

    if (uploadResponse.error) {
      showTabStatus(tabName, uploadResponse.error, 'error')
    } else if (uploadResponse.url) {
      chrome.tabs.create({ url: uploadResponse.url })
      window.close()
    } else if (uploadResponse.created !== undefined) {
      const msg = `Imported: ${uploadResponse.created} new, ${uploadResponse.updated} updated, ${uploadResponse.skipped} skipped`
      showTabStatus(tabName, msg, 'success')
      setTimeout(() => hideTabStatus(tabName), 4000)
    } else {
      showTabStatus(tabName, 'Export successful!', 'success')
      setTimeout(() => hideTabStatus(tabName), 2000)
    }
  } catch (error) {
    showTabStatus(tabName, 'Export failed: ' + error.message, 'error')
  } finally {
    if (exportBtn) exportBtn.disabled = false
  }
}

/**
 * Handle copy for a tab
 */
async function handleCopy(tabName) {
  const dataType = selectedDataTypes[tabName]
  if (!dataType) {
    showTabStatus(tabName, 'Please select data to copy', 'error')
    return
  }

  const copyBtn = document.getElementById(`copy${capitalize(tabName)}`)
  if (copyBtn) copyBtn.disabled = true

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType
    })

    if (response.error) {
      showTabStatus(tabName, response.error, 'error')
      return
    }

    const jsonString = JSON.stringify(response.data, null, 2)
    await navigator.clipboard.writeText(jsonString)

    showTabStatus(tabName, `${getDataTypeName(dataType)} data copied!`, 'success')
    setTimeout(() => hideTabStatus(tabName), 2000)
  } catch (error) {
    showTabStatus(tabName, 'Copy failed: ' + error.message, 'error')
  } finally {
    if (copyBtn) copyBtn.disabled = false
  }
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

/**
 * Handle messages from content script / background
 */
function handleMessages(message) {
  if (message.action === 'dataCaptured') {
    // Refresh cache status
    refreshAllCaches()

    // Show notification on the appropriate tab
    const tabName = getTabForDataType(message.dataType)
    if (tabName) {
      showTabStatus(tabName, `${getDataTypeName(message.dataType)} data captured!`, 'success')
      setTimeout(() => hideTabStatus(tabName), 2000)
    }
  }
}

/**
 * Get which tab a data type belongs to
 */
function getTabForDataType(dataType) {
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
