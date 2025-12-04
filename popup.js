/**
 * @fileoverview Popup script for the Granblue Fantasy Chrome extension.
 * Handles user interaction with the popup UI, login, and data operations.
 *
 * This version uses passive data interception - it works with cached data
 * that was captured as the user browsed the game, rather than making
 * direct API calls to GBF servers.
 */

import { performLogin, fetchUserInfo, getApiBaseUrl } from "./auth.js"
import {
  updateAvatarImage,
  updateMainMessage,
  resetMainMessage,
  refreshAuthUI,
  updateStatus,
  resetStatus,
  updateCacheStatusDisplay,
  getSelectedDataType,
  setSelectedDataType
} from "./ui.js"
import { formatCacheStatus } from "./cache.js"

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners()
  initializeSiteSelector()
  refreshAuthUI()
  refreshCacheStatus()
})

// ==========================================
// SITE SELECTION
// ==========================================

/**
 * Initialize the site selector with saved preference
 */
async function initializeSiteSelector() {
  const siteSelect = document.getElementById("siteSelect")
  if (!siteSelect) return

  // Load saved preference
  const { selectedSite } = await chrome.storage.local.get("selectedSite")
  if (selectedSite) {
    siteSelect.value = selectedSite
  }

  // Save preference when changed
  siteSelect.addEventListener("change", async () => {
    await chrome.storage.local.set({ selectedSite: siteSelect.value })
  })
}

/**
 * Get the currently selected site
 * @returns {Promise<string>} 'production' or 'staging'
 */
async function getSelectedSite() {
  const { selectedSite } = await chrome.storage.local.get("selectedSite")
  return selectedSite || "production"
}

// ==========================================
// EVENT LISTENERS
// ==========================================

/**
 * Sets up all event listeners for the popup
 */
function initializeEventListeners() {
  // Get element references
  const elements = {
    showLogin: document.getElementById("showLogin"),
    avatar: document.getElementById("avatar"),
    backToMain: document.getElementById("backToMain"),
    mainPane: document.getElementById("mainPane"),
    loginPane: document.getElementById("loginPane"),
    loggedInPane: document.getElementById("loggedInPane"),
    closeLoggedInPane: document.getElementById("closeLoggedInPane"),
    mainButtons: document.getElementById("main-buttons"),
    loginButton: document.getElementById("loginButton"),
    logoutButton: document.getElementById("logoutButton"),
    goToProfile: document.getElementById("goToProfileButton"),
    acknowledge: document.getElementById("acknowledgeButton"),
    showWarning: document.getElementById("showWarning"),
    warning: document.getElementById("warning"),
    exportButton: document.getElementById("exportButton"),
    copyButton: document.getElementById("copyButton"),
    clearCacheButton: document.getElementById("clearCacheButton")
  }

  // Set up UI navigation handlers
  setupNavigationHandlers(elements)

  // Set up authentication handlers
  setupAuthHandlers(elements)

  // Set up warning notice handlers
  setupWarningHandlers(elements)

  // Set up data operation handlers
  setupDataHandlers(elements)

  // Set up message listener
  chrome.runtime.onMessage.addListener(handleMessages)
}

/**
 * Sets up handlers for navigating between panes
 */
function setupNavigationHandlers(elements) {
  // Show login pane
  elements.showLogin?.addEventListener("click", () => {
    elements.mainPane.classList.add("inactive")
    elements.loginPane.classList.add("active")
  })

  // Back to main from login
  elements.backToMain?.addEventListener("click", () => {
    elements.mainPane.classList.remove("inactive")
    elements.loginPane.classList.remove("active")
  })

  // Close logged in pane
  elements.closeLoggedInPane?.addEventListener("click", () => {
    elements.mainPane.classList.remove("inactive")
    elements.loggedInPane.classList.remove("active")
  })

  // Avatar click (show profile if logged in, else login)
  elements.avatar?.addEventListener("click", async () => {
    const { noticeAcknowledged, gbAuth } = await chrome.storage.local.get([
      "noticeAcknowledged",
      "gbAuth",
    ])

    // Only proceed if warning acknowledged
    if (!noticeAcknowledged) {
      shakeWarningNotice(elements.warning)
      return
    }

    elements.mainPane.classList.add("inactive")

    if (gbAuth && gbAuth.access_token) {
      document.getElementById("loggedInUsername").textContent = gbAuth.user.username
      elements.loggedInPane.classList.add("active")
      elements.mainButtons.style.display = "none"
    } else {
      elements.loginPane.classList.add("active")
    }
  })
}

/**
 * Sets up handlers for authentication actions
 */
function setupAuthHandlers(elements) {
  // Login button
  elements.loginButton?.addEventListener("click", async () => {
    const username = document.getElementById("loginUsername").value.trim()
    const password = document.getElementById("loginPassword").value.trim()

    if (!username || !password) {
      updateLoginStatus("Please enter username and password", "error")
      return
    }

    elements.loginButton.disabled = true
    updateLoginStatus("Logging in...", "info")

    try {
      // Perform login and store auth data
      let gbAuth = await performLogin(username, password)
      await chrome.storage.local.set({ gbAuth })
      updateLoginStatus("Login successful!", "success")

      // Fetch additional user info
      const userInfo = await fetchUserInfo(
        gbAuth.user.username,
        gbAuth.access_token
      )
      gbAuth = {
        ...gbAuth,
        avatar: userInfo.avatar,
        language: userInfo.language,
      }
      await chrome.storage.local.set({ gbAuth })

      // Update the avatar in the UI
      updateAvatarImage(userInfo.avatar)

      // Slide out the login pane after a short delay
      setTimeout(() => {
        elements.loginPane.classList.remove("active")
        elements.mainPane.classList.remove("inactive")
        elements.mainButtons.style.display = "none"
        resetLoginStatus()
        updateMainMessage()
      }, 1500)
    } catch (err) {
      console.error(err)
      updateLoginStatus(err.message || "Login error", "error")
    } finally {
      elements.loginButton.disabled = false
    }
  })

  // Go to profile button
  elements.goToProfile?.addEventListener("click", async () => {
    const { gbAuth } = await chrome.storage.local.get("gbAuth")
    if (gbAuth && gbAuth.user && gbAuth.user.username) {
      const profileUrl = `https://granblue.team/${gbAuth.user.username}`
      chrome.tabs.create({ url: profileUrl })
    }
  })

  // Logout button
  elements.logoutButton?.addEventListener("click", async () => {
    await chrome.storage.local.remove(["gbAuth", "noticeAcknowledged"])
    elements.loggedInPane.classList.remove("active")
    elements.mainPane.classList.remove("inactive")
    elements.warning.style.display = "flex"
    updateAvatarImage()
    resetMainMessage()
  })
}

/**
 * Sets up handlers for warning notice
 */
function setupWarningHandlers(elements) {
  // Acknowledge warning
  elements.acknowledge?.addEventListener("click", () => {
    chrome.storage.local.set({ noticeAcknowledged: true }, () => {
      elements.warning.style.display = "none"
      elements.mainButtons.style.display = "flex"
    })
  })

  // Show warning button
  elements.showWarning?.addEventListener("click", () => {
    chrome.storage.local.set({ noticeAcknowledged: false }, () => {
      refreshAuthUI()
    })
  })
}

/**
 * Sets up handlers for data operations (export/copy)
 */
function setupDataHandlers(elements) {
  // Export button - uploads cached data to granblue.team
  elements.exportButton?.addEventListener("click", async () => {
    elements.exportButton.disabled = true
    updateStatus("Preparing export...", "info")

    try {
      // Get the selected data type and site
      const dataType = getSelectedDataType()
      const site = await getSelectedSite()

      if (!dataType) {
        updateStatus("Please select data to export.", "error")
        elements.exportButton.disabled = false
        return
      }

      // Get cached data
      const response = await chrome.runtime.sendMessage({
        action: 'getCachedData',
        dataType: dataType
      })

      if (response.error) {
        updateStatus(response.error, "error")
        elements.exportButton.disabled = false
        return
      }

      // Upload based on data type
      let uploadResponse
      if (dataType === 'party') {
        uploadResponse = await chrome.runtime.sendMessage({
          action: 'uploadPartyData',
          data: response.data,
          site: site
        })
      } else if (dataType.startsWith('detail_')) {
        uploadResponse = await chrome.runtime.sendMessage({
          action: 'uploadDetailData',
          data: response.data,
          dataType: dataType,
          site: site
        })
      } else if (dataType.startsWith('collection_')) {
        uploadResponse = await chrome.runtime.sendMessage({
          action: 'uploadCollectionData',
          data: response.data,
          dataType: dataType,
          updateExisting: false,
          site: site
        })
      } else {
        updateStatus("List export not yet supported", "error")
        elements.exportButton.disabled = false
        return
      }

      if (uploadResponse.error) {
        updateStatus(uploadResponse.error, "error")
      } else if (uploadResponse.url) {
        // Open the new party page
        chrome.tabs.create({ url: uploadResponse.url })
        window.close()
      } else if (uploadResponse.created !== undefined) {
        // Collection import result
        const msg = `Imported: ${uploadResponse.created} new, ${uploadResponse.updated} updated, ${uploadResponse.skipped} skipped`
        updateStatus(msg, "success")
        setTimeout(resetStatus, 4000)
      } else {
        updateStatus("Export successful!", "success")
        setTimeout(resetStatus, 2000)
      }
    } catch (error) {
      updateStatus("Export failed: " + error.message, "error")
    } finally {
      elements.exportButton.disabled = false
    }
  })

  // Copy button - copies cached data to clipboard
  elements.copyButton?.addEventListener("click", async () => {
    elements.copyButton.disabled = true

    try {
      const dataType = getSelectedDataType()
      if (!dataType) {
        updateStatus("Please select data to copy.", "error")
        elements.copyButton.disabled = false
        return
      }

      const response = await chrome.runtime.sendMessage({
        action: 'getCachedData',
        dataType: dataType
      })

      if (response.error) {
        updateStatus(response.error, "error")
        elements.copyButton.disabled = false
        return
      }

      const jsonString = JSON.stringify(response.data, null, 2)
      await navigator.clipboard.writeText(jsonString)

      updateStatus(`${getDataTypeName(dataType)} data copied!`, "success")
      setTimeout(resetStatus, 2000)
    } catch (error) {
      updateStatus("Copy failed: " + error.message, "error")
    } finally {
      elements.copyButton.disabled = false
    }
  })

  // Clear cache button
  elements.clearCacheButton?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ action: 'clearCache' })
    setSelectedDataType(null)
    updateStatus("Cache cleared", "info")
    setTimeout(resetStatus, 2000)
    refreshCacheStatus()
  })
}

// ==========================================
// CACHE STATUS
// ==========================================

/**
 * Refresh and display cache status
 */
async function refreshCacheStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCacheStatus' })

    if (response.error) {
      updateCacheStatusDisplay(null, response.error)
      return
    }

    const formatted = formatCacheStatus(response)
    updateCacheStatusDisplay(formatted)
  } catch (error) {
    updateCacheStatusDisplay(null, "Could not get cache status")
  }
}

/**
 * Get display name for data type
 */
function getDataTypeName(dataType) {
  const names = {
    party: 'Party',
    detail_npc: 'Character',
    detail_weapon: 'Weapon',
    detail_summon: 'Summon',
    list_npc: 'Character list',
    list_weapon: 'Weapon list',
    list_summon: 'Summon list',
    collection_weapon: 'Weapon Collection',
    collection_npc: 'Character Collection',
    collection_summon: 'Summon Collection',
    collection_artifact: 'Artifact Collection'
  }
  return names[dataType] || dataType
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

/**
 * Handles messages from content script / background
 */
function handleMessages(message) {
  if (message.action === "dataCaptured") {
    // New data was captured, refresh the status
    refreshCacheStatus()
    updateStatus(`${getDataTypeName(message.dataType)} data captured!`, "success")
    setTimeout(resetStatus, 2000)
  } else if (message.action === "error") {
    updateStatus(message.error, "error")
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Updates the login status message
 */
function updateLoginStatus(message, type = "info") {
  const loginStatus = document.getElementById("loginStatus")
  if (!loginStatus) return
  loginStatus.style.display = "block"
  loginStatus.textContent = message
  loginStatus.className = `status-${type}`
}

/**
 * Resets the login status message
 */
function resetLoginStatus() {
  const loginStatus = document.getElementById("loginStatus")
  if (!loginStatus) return
  loginStatus.style.display = "none"
  loginStatus.textContent = ""
  loginStatus.className = ""
}

/**
 * Adds shake animation to the warning notice
 */
function shakeWarningNotice(warningElement) {
  if (!warningElement) return
  // Remove and force a reflow to re-trigger the animation
  warningElement.classList.remove("shake")
  void warningElement.offsetWidth

  // Add shake animation to the notice element
  warningElement.classList.add("shake")

  // Remove the class after the animation completes
  setTimeout(() => warningElement.classList.remove("shake"), 600)
}
