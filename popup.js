/**
 * @fileoverview Popup script for the Granblue Fantasy Chrome extension.
 * Handles user interaction with the popup UI, login, and data operations.
 */

import { performLogin, fetchUserInfo } from "./auth.js"
import {
  updateAvatarImage,
  updateMainMessage,
  resetMainMessage,
  refreshAuthUI,
  updateStatus,
  resetStatus
} from "./ui.js"

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners()
  refreshAuthUI()
})

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
    importButton: document.getElementById("importButton"),
    copyButton: document.getElementById("copyButton")
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
  elements.showLogin.addEventListener("click", () => {
    elements.mainPane.classList.add("inactive")
    elements.loginPane.classList.add("active")
  })

  // Back to main from login
  elements.backToMain.addEventListener("click", () => {
    elements.mainPane.classList.remove("inactive")
    elements.loginPane.classList.remove("active")
  })

  // Close logged in pane
  elements.closeLoggedInPane.addEventListener("click", () => {
    elements.mainPane.classList.remove("inactive")
    elements.loggedInPane.classList.remove("active")
  })

  // Avatar click (show profile if logged in, else login)
  elements.avatar.addEventListener("click", async () => {
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
  elements.loginButton.addEventListener("click", async () => {
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
  elements.goToProfile.addEventListener("click", async () => {
    const { gbAuth } = await chrome.storage.local.get("gbAuth")
    if (gbAuth && gbAuth.user && gbAuth.user.username) {
      const profileUrl = `https://granblue.team/${gbAuth.user.username}`
      chrome.tabs.create({ url: profileUrl })
    }
  })

  // Logout button
  elements.logoutButton.addEventListener("click", async () => {
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
  elements.acknowledge.addEventListener("click", () => {
    chrome.storage.local.set({ noticeAcknowledged: true }, () => {
      elements.warning.style.display = "none"
      elements.mainButtons.style.display = "flex"
    })
  })

  // Show warning button
  elements.showWarning.addEventListener("click", () => {
    chrome.storage.local.set({ noticeAcknowledged: false }, () => {
      refreshAuthUI()
    })
  })
}

/**
 * Sets up handlers for data operations (import/copy)
 */
function setupDataHandlers(elements) {
  // Import button
  elements.importButton.addEventListener("click", async () => {
    console.log("Importing...")
    elements.importButton.disabled = true
  
    try {
      const activeTab = await getActiveTab()
      
      if (!isGranblueFantasyPage(activeTab.url)) {
        updateStatus("Please navigate to a Granblue Fantasy game page", "error")
        elements.importButton.disabled = false
        return
      }
      
      if (!isValidDataPage(activeTab.url)) {
        updateStatus(
          "Please navigate to a party, weapon, character, or summon page to import.",
          "error"
        )
        elements.importButton.disabled = false
        return
      }
      
      // Send message to upload data
      chrome.runtime.sendMessage({
        action: "getData",
        uploadData: true
      })
    } catch (error) {
      elements.importButton.disabled = false
      updateStatus("Error: " + (error.message || "Unknown error"), "error")
    }
  })

  // Copy button
  elements.copyButton.addEventListener("click", async () => {
    console.log("Copying...")
    elements.copyButton.disabled = true
  
    try {
      const activeTab = await getActiveTab()
      
      if (!isGranblueFantasyPage(activeTab.url)) {
        updateStatus("Please navigate to a Granblue Fantasy game page", "error")
        elements.copyButton.disabled = false
        return
      }
      
      if (!isValidDataPage(activeTab.url)) {
        updateStatus(
          "Please navigate to a party, weapon, character, or summon page to copy.",
          "error"
        )
        elements.copyButton.disabled = false
        return
      }
      
      // Send message to copy data without uploading
      chrome.runtime.sendMessage({
        action: "getData",
        uploadData: false
      })
    } catch (error) {
      elements.copyButton.disabled = false
      updateStatus("Error: " + (error.message || "Unknown error"), "error")
    }
  })
}

/**
 * Retrieves the active tab
 */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })
  
  if (!tabs || !tabs[0]) {
    throw new Error("No active tab found")
  }
  
  return tabs[0]
}

/**
 * Checks if the URL is a Granblue Fantasy game page
 */
function isGranblueFantasyPage(url) {
  return url.includes("game.granbluefantasy.jp")
}

/**
 * Checks if the URL is a valid data page (detail or party)
 */
function isValidDataPage(url) {
  return url.includes("#archive/detail_") || url.includes("#party/")
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

/**
 * Handles messages from content script / background
 */
function handleMessages(message) {
  console.log("Popup received message:", message)

  if (message.action === "dataFetched") {
    handleDataFetched(message)
  } else if (message.action === "error") {
    updateStatus(message.error, "error")
    enableButtons()
  } else if (message.action === "urlReady") {
    // Open the URL in a new tab and close the extension
    chrome.tabs.create({ url: message.url }, () => {
      window.close()
    })
  }
}

/**
 * Handles dataFetched messages
 */
function handleDataFetched(message) {
  updateVersionDisplay(message.version)
  
  // Handle upload results if any
  if (message.uploadResult) {
    if (message.uploadResult.error) {
      // Show error message
      updateStatus(message.uploadResult.error, "error")
    } else if (message.uploadResult.shortcode) {
      // For party data with shortcode - redirect to party page
      chrome.tabs.create({ url: `https://granblue.team/p/${message.uploadResult.shortcode}` }, () => {
        window.close() // Close popup after redirecting
      })
      return // Early return to avoid clipboard copy
    } else if (message.uploadResult.message) {
      // For detail data with success message
      updateStatus(`✓ ${message.uploadResult.message}`, "success")
      setTimeout(resetStatus, 2000)
      
      // Also copy to clipboard for convenience
      copyToClipboard(message.data, "Data also copied to clipboard")
      enableButtons()
      return // Early return
    }
  }
  
  // If we're here, we're just copying to clipboard (no upload or upload failed)
  const successMessage = getSuccessMessageForType(message.dataType)
  copyToClipboard(message.data, successMessage)
}

/**
 * Updates the version display if available
 */
function updateVersionDisplay(version) {
  if (version) {
    const versionElem = document.querySelector(".version")
    if (versionElem) {
      versionElem.textContent = version
    }
  }
}

/**
 * Gets an appropriate success message based on data type
 */
function getSuccessMessageForType(dataType) {
  if (dataType === "party") {
    return "✓ Party data copied!"
  } else if (dataType === "detail_npc") {
    return "✓ Character data copied!"
  } else if (dataType === "detail_weapon") {
    return "✓ Weapon data copied!"
  } else if (dataType === "detail_summon") {
    return "✓ Summon data copied!"
  } else {
    return "✓ Data copied to clipboard!"
  }
}

/**
 * Copies data to clipboard and shows a success message
 */
function copyToClipboard(data, successMessage) {
  navigator.clipboard
    .writeText(data)
    .then(() => {
      updateStatus(successMessage, "success")
      setTimeout(resetStatus, 2000)
    })
    .catch((err) => {
      console.error("Clipboard error:", err)
      updateStatus("Failed to copy data", "error")
    })
    .finally(enableButtons)
}

/**
 * Re-enables the import and copy buttons
 */
function enableButtons() {
  document.getElementById("importButton").disabled = false
  document.getElementById("copyButton").disabled = false
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Updates the login status message
 */
function updateLoginStatus(message, type = "info") {
  const loginStatus = document.getElementById("loginStatus")
  loginStatus.style.display = "block"
  loginStatus.textContent = message
  loginStatus.className = `status-${type}`
}

/**
 * Resets the login status message
 */
function resetLoginStatus() {
  const loginStatus = document.getElementById("loginStatus")
  loginStatus.style.display = "none"
  loginStatus.textContent = ""
  loginStatus.className = ""
}

/**
 * Adds shake animation to the warning notice
 */
function shakeWarningNotice(warningElement) {
  // Remove and force a reflow to re‑trigger the animation
  warningElement.classList.remove("shake")
  void warningElement.offsetWidth

  // Add shake animation to the notice element
  warningElement.classList.add("shake")
  
  // Remove the class after the animation completes
  setTimeout(() => warningElement.classList.remove("shake"), 600)
}