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
  
  if (!mainButtons || !warningNotice) return

  // Handle logged in state
  if (gbAuth && gbAuth.access_token) {
    mainButtons.style.display = "none"
    warningNotice.style.display = "none"
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
    } else {
      warningNotice.style.display = "flex"
      mainButtons.style.display = "none"
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
 * Updates the main message area based on current page URL.
 * Shows different messages depending on if user is on a valid game page.
 */
export function updateMainMessage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return
    
    const url = tabs[0].url
    console.log("Active tab URL:", url)

    const messageElem = document.querySelector("#mainPane .message")
    const importContainer = document.getElementById("import-container")
    
    if (!messageElem || !importContainer) return

    // Check if on a valid import page
    if (isPartyPage(url) || isDetailPage(url)) {
      // Show import buttons, hide message
      showImportContainer(importContainer, url)
      messageElem.style.display = "none"
    } else {
      // Show message, hide import container
      showAppropriateMessage(messageElem, url)
      importContainer.style.display = "none"
    }
  })
}

/**
 * Checks if URL is a party page.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if it's a party page.
 */
function isPartyPage(url) {
  return url.includes("#party")
}

/**
 * Checks if URL is a detail page.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if it's a detail page.
 */
function isDetailPage(url) {
  return url.includes("#archive/detail_")
}

/**
 * Shows the import container and updates button text based on page type.
 * @param {HTMLElement} container - The import container element.
 * @param {string} url - Current page URL.
 */
function showImportContainer(container, url) {
  container.style.display = "flex"
  
  // Update button text for different detail pages
  const importButton = document.getElementById("importButton")
  if (importButton && isDetailPage(url)) {
    if (url.includes("detail_npc")) {
      importButton.textContent = "Import character"
    } else if (url.includes("detail_weapon")) {
      importButton.textContent = "Import weapon"
    } else if (url.includes("detail_summon")) {
      importButton.textContent = "Import summon"
    } else {
      importButton.textContent = "Import data"
    }
  }
}

/**
 * Shows appropriate message based on URL.
 * @param {HTMLElement} messageElem - The message element.
 * @param {string} url - Current page URL.
 */
function showAppropriateMessage(messageElem, url) {
  // If not on a list or party page, show navigation instructions
  if (!url.includes("#list") && !url.includes("#party/index/0/npc/0")) {
    messageElem.innerHTML = `
      <div class="blue notice">
        <p>Navigate to a party, weapon, character, or summon to get started</p>
      </div>
    `
  } else {
    // Default message
    messageElem.innerHTML = `
      <p>
        This extension lets you quickly and easily import your parties,
        weapons, characters and summons into granblue.team.
      </p>
    `
  }
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
      This extension lets you quickly and easily import your parties, weapons, 
      characters, and summons into granblue.team.
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
  notice.className = `status-${type}`
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
  notice.className = ""
  status.textContent = ""
}