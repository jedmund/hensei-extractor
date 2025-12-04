/**
 * @fileoverview UI helper functions for the Granblue Fantasy Chrome extension.
 * Manages UI state updates and display for the popup.
 */

/**
 * Updates the avatar image in the popup.
 * @param {Object} avatarInfo - Contains `picture` and `element` properties.
 */
export function updateAvatarImage(avatarInfo) {
  const avatarImg = document.getElementById("avatar")
  if (!avatarImg) return

  if (avatarInfo) {
    // Update to user's custom avatar
    avatarImg.src = `https://granblue.team/profile/${avatarInfo.picture}@2x.png`
    // Add element-specific class
    avatarImg.className = `avatar ${avatarInfo.element}`
  } else {
    // Reset to default avatar
    avatarImg.src = "https://granblue.team/profile/npc@2x.png"
    avatarImg.className = "avatar"
  }
}

/**
 * Refreshes the UI based on stored authentication data.
 * Shows/hides elements based on login state and notice acknowledgment.
 */
export async function refreshAuthUI() {
  const { gbAuth, noticeAcknowledged } = await chrome.storage.local.get([
    "gbAuth",
    "noticeAcknowledged"
  ])

  const mainButtons = document.getElementById("main-buttons")
  const warningNotice = document.getElementById("warning")
  const exportContainer = document.getElementById("export-container")

  if (!mainButtons || !warningNotice) return

  // Handle logged in state
  if (gbAuth && gbAuth.access_token) {
    mainButtons.style.display = "none"
    warningNotice.style.display = "none"
    if (exportContainer) exportContainer.style.display = "flex"
    updateMainMessage()

    // Update avatar if available
    if (gbAuth.avatar) {
      updateAvatarImage(gbAuth.avatar)
    }

    // Update username in logged-in pane
    updateLoggedInUsername(gbAuth.user?.username)
  }
  // Handle logged out state
  else {
    if (noticeAcknowledged) {
      warningNotice.style.display = "none"
      mainButtons.style.display = "flex"
      if (exportContainer) exportContainer.style.display = "none"
    } else {
      warningNotice.style.display = "flex"
      mainButtons.style.display = "none"
      if (exportContainer) exportContainer.style.display = "none"
    }
  }
}

/**
 * Updates the username displayed in the logged-in pane.
 * @param {string} username - The username to display.
 */
function updateLoggedInUsername(username) {
  const usernameElem = document.getElementById("loggedInUsername")
  if (usernameElem && username) {
    usernameElem.textContent = username
  }
}

/**
 * Updates the main message area.
 */
export function updateMainMessage() {
  const messageElem = document.querySelector("#mainPane .message")
  if (!messageElem) return

  messageElem.innerHTML = `
    <p>
      This extension passively captures your game data as you browse.
      No additional requests are made to GBF servers.
    </p>
  `
  messageElem.style.display = "block"
}

/**
 * Resets the main message to default.
 */
export function resetMainMessage() {
  const messageElem = document.querySelector("#mainPane .message")
  if (!messageElem) return

  messageElem.innerHTML = `
    <p>
      This extension passively captures your game data as you browse.
      No additional requests are made to GBF servers.
    </p>
  `
  messageElem.style.display = "block"
}

/**
 * Updates status message with specified type.
 * @param {string} message - The message to display.
 * @param {string} type - Message type (info, success, error).
 */
export function updateStatus(message, type = "info") {
  const notice = document.getElementById("import-notice")
  const status = document.getElementById("import-status")

  if (!notice || !status) return

  notice.style.display = "block"
  notice.className = `notice status-${type}`
  status.textContent = message
}

/**
 * Resets the status message.
 */
export function resetStatus() {
  const notice = document.getElementById("import-notice")
  const status = document.getElementById("import-status")

  if (!notice || !status) return

  notice.style.display = "none"
  notice.className = "notice"
  status.textContent = ""
}

// Currently selected data type for export
let selectedDataType = null

/**
 * Gets the currently selected data type
 * @returns {string|null} The selected data type or null
 */
export function getSelectedDataType() {
  return selectedDataType
}

/**
 * Sets the selected data type and updates button states
 * @param {string|null} dataType - The data type to select
 */
export function setSelectedDataType(dataType) {
  selectedDataType = dataType
  updateButtonStates()
}

/**
 * Updates the export/copy button enabled states based on selection
 */
function updateButtonStates() {
  const exportButton = document.getElementById("exportButton")
  const copyButton = document.getElementById("copyButton")

  if (selectedDataType) {
    exportButton?.removeAttribute("disabled")
    copyButton?.removeAttribute("disabled")
  } else {
    exportButton?.setAttribute("disabled", "true")
    copyButton?.setAttribute("disabled", "true")
  }
}

/**
 * Updates the cache status display in the popup.
 * @param {Object} status - Formatted cache status object.
 * @param {string} error - Error message if status couldn't be retrieved.
 * @param {Function} onSelect - Callback when an item is selected.
 */
export function updateCacheStatusDisplay(status, error = null, onSelect = null) {
  const cacheItems = document.getElementById("cache-items")
  if (!cacheItems) return

  if (error) {
    cacheItems.innerHTML = `<p class="cache-error">${error}</p>`
    setSelectedDataType(null)
    return
  }

  if (!status) {
    cacheItems.innerHTML = `<p class="cache-empty">Browse the game to capture data</p>`
    setSelectedDataType(null)
    return
  }

  // Check if any data is available
  const hasData = Object.values(status).some(s => s.available)

  if (!hasData) {
    cacheItems.innerHTML = `<p class="cache-empty">Browse the game to capture data</p>`
    setSelectedDataType(null)
    return
  }

  // Build cache status HTML
  let html = ''
  const displayOrder = [
    'party',
    'detail_npc', 'detail_weapon', 'detail_summon',
    'collection_npc', 'collection_weapon', 'collection_summon', 'collection_artifact',
    'list_npc', 'list_weapon', 'list_summon'
  ]

  let firstAvailable = null

  for (const type of displayOrder) {
    const info = status[type]
    if (!info || !info.available) continue

    if (!firstAvailable) firstAvailable = type

    const icon = getDataTypeIcon(type)
    const isSelected = selectedDataType === type
    const selectedClass = isSelected ? 'selected' : ''

    html += `
      <div class="cache-item ${info.statusClass} ${selectedClass}" data-type="${type}">
        <span class="cache-icon">${icon}</span>
        <span class="cache-name">${info.displayName}</span>
        <span class="cache-age">${info.statusText}</span>
      </div>
    `
  }

  cacheItems.innerHTML = html || `<p class="cache-empty">Browse the game to capture data</p>`

  // Auto-select first available if nothing selected
  if (!selectedDataType && firstAvailable) {
    setSelectedDataType(firstAvailable)
    // Update the UI to show selection
    const firstItem = cacheItems.querySelector(`[data-type="${firstAvailable}"]`)
    firstItem?.classList.add('selected')
  }

  // Add click handlers to cache items
  const items = cacheItems.querySelectorAll('.cache-item[data-type]')
  items.forEach(item => {
    item.addEventListener('click', () => {
      const type = item.getAttribute('data-type')

      // Don't allow selecting stale items
      if (item.classList.contains('stale')) return

      // Update selection
      items.forEach(i => i.classList.remove('selected'))
      item.classList.add('selected')
      setSelectedDataType(type)

      // Call the onSelect callback if provided
      if (onSelect) onSelect(type)
    })
  })
}

/**
 * Get icon for data type
 */
function getDataTypeIcon(dataType) {
  const icons = {
    party: '⚔️',
    detail_npc: '👤',
    detail_weapon: '🗡️',
    detail_summon: '✨',
    list_npc: '👥',
    list_weapon: '🗡️',
    list_summon: '✨',
    collection_weapon: '🗡️',
    collection_npc: '👥',
    collection_summon: '✨',
    collection_artifact: '💎'
  }
  return icons[dataType] || '📄'
}
