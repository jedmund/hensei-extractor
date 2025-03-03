import { performLogin, fetchUserInfo } from "./auth.js"
import {
  updateAvatarImage,
  updateMainMessage,
  resetMainMessage,
  refreshAuthUI,
  updateStatus,
  resetStatus
} from "./ui.js"

document.addEventListener("DOMContentLoaded", () => {
  // Element references
  const showLoginBtn = document.getElementById("showLogin")
  const avatarImg = document.getElementById("avatar")
  const backToMainBtn = document.getElementById("backToMain")
  const mainPane = document.getElementById("mainPane")
  const loginPane = document.getElementById("loginPane")
  const loggedInPane = document.getElementById("loggedInPane")
  const closeLoggedInPaneBtn = document.getElementById("closeLoggedInPane")
  const mainButtons = document.getElementById("main-buttons")
  const loginButton = document.getElementById("loginButton")
  const logoutButton = document.getElementById("logoutButton")
  const goToProfileButton = document.getElementById("goToProfileButton")
  const loginStatus = document.getElementById("loginStatus")
  const acknowledgeButton = document.getElementById("acknowledgeButton")
  const showWarning = document.getElementById("showWarning")
  const warningNotice = document.getElementById("warning")
  const importButton = document.getElementById("importButton")
  const copyButton = document.getElementById("copyButton")

  // Helper functions for login status updates
  function updateLoginStatus(message, type = "info") {
    loginStatus.style.display = "block"
    loginStatus.textContent = message
    loginStatus.className = `status-${type}`
  }
  function resetLoginStatus() {
    loginStatus.style.display = "none"
    loginStatus.textContent = ""
    loginStatus.className = ""
  }

  // Listener for the "I understand" button.
  acknowledgeButton.addEventListener("click", () => {
    chrome.storage.local.set({ noticeAcknowledged: true }, () => {
      warningNotice.style.display = "none"
      mainButtons.style.display = "flex"
    })
  })

  // Listener for the "Show Warning" button in the logged-in pane.
  showWarning.addEventListener("click", () => {
    chrome.storage.local.set({ noticeAcknowledged: false }, () => {
      // When the warning is re-enabled, update the UI.
      refreshAuthUI()
    })
  })

  // Show the login pane when the "Log in" button is clicked.
  showLoginBtn.addEventListener("click", () => {
    mainPane.classList.add("inactive")
    loginPane.classList.add("active")
  })

  // Close the login pane.
  backToMainBtn.addEventListener("click", () => {
    mainPane.classList.remove("inactive")
    loginPane.classList.remove("active")
  })

  // When clicking the avatar, show the logged-in pane if authenticated; otherwise, show the login pane.
  avatarImg.addEventListener("click", async () => {
    const { noticeAcknowledged, gbAuth } = await chrome.storage.local.get([
      "noticeAcknowledged",
      "gbAuth",
    ])
    console.log("noticeAcknowledged:", noticeAcknowledged) // Debug log

    console.log(noticeAcknowledged)
    // Only allow opening the login pane if the warning has been acknowledged
    if (!noticeAcknowledged) {
      // Remove and force a reflow to re‑trigger the animation.
      warningNotice.classList.remove("shake")
      void warningNotice.offsetWidth

      // Add shake animation to the notice element.
      warningNotice.classList.add("shake")
      // Remove the class after the animation completes (500ms).
      setTimeout(() => warningNotice.classList.remove("shake"), 500)
      return
    }

    mainPane.classList.add("inactive")

    if (gbAuth && gbAuth.access_token) {
      document.getElementById("loggedInUsername").textContent =
        gbAuth.user.username
      loggedInPane.classList.add("active")
      mainButtons.style.display = "none"
    } else {
      loginPane.classList.add("active")
    }
  })

  // Close the logged-in pane.
  closeLoggedInPaneBtn.addEventListener("click", () => {
    mainPane.classList.remove("inactive")
    loggedInPane.classList.remove("active")
  })

  // "Go to profile" button.
  goToProfileButton.addEventListener("click", async () => {
    const { gbAuth } = await chrome.storage.local.get("gbAuth")
    if (gbAuth && gbAuth.user && gbAuth.user.username) {
      const profileUrl = `https://granblue.team/${gbAuth.user.username}`
      chrome.tabs.create({ url: profileUrl })
    }
  })

  // "Log out" button.
  logoutButton.addEventListener("click", async () => {
    await chrome.storage.local.remove(["gbAuth", "noticeAcknowledged"])
    loggedInPane.classList.remove("active")
    mainPane.classList.remove("inactive")
    warningNotice.style.display = "flex"
    updateAvatarImage()
    resetMainMessage()
  })

  // Login button handler.
  loginButton.addEventListener("click", async () => {
    const username = document.getElementById("loginUsername").value.trim()
    const password = document.getElementById("loginPassword").value.trim()

    if (!username || !password) {
      updateLoginStatus("Please enter username and password", "error")
      return
    }

    loginButton.disabled = true
    updateLoginStatus("Logging in...", "info")

    try {
      // Perform login and store auth data.
      let gbAuth = await performLogin(username, password)
      await chrome.storage.local.set({ gbAuth })
      updateLoginStatus("Login successful!", "success")

      // Fetch additional user info.
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

      // Update the avatar in the UI.
      updateAvatarImage(userInfo.avatar)

      // Slide out the login pane after a short delay.
      setTimeout(() => {
        loginPane.classList.remove("active")
        mainPane.classList.remove("inactive")
        mainButtons.style.display = "none"
        resetLoginStatus()
        updateMainMessage()
      }, 1500)
    } catch (err) {
      console.error(err)
      updateLoginStatus(err.message || "Login error", "error")
    } finally {
      loginButton.disabled = false
    }
  })

  // Import team button handler
  importButton.addEventListener("click", async function () {
    console.log("Importing...")
    importButton.disabled = true
  
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
  
      // Ensure we're on a Granblue Fantasy game page
      if (!tab.url.includes("game.granbluefantasy.jp")) {
        updateStatus("Please navigate to a Granblue Fantasy game page", "error")
        importButton.disabled = false
        return
      }
  
      // Check if we're on a detail page or party page
      const isDetailPage = tab.url.includes("#archive/detail_")
      const isPartyPage = tab.url.includes("#party/")
  
      if (!isDetailPage && !isPartyPage) {
        updateStatus(
          "Please navigate to a party, weapon, character, or summon page to import.",
          "error"
        )
        importButton.disabled = false
        return
      }
  
      // For import button, we want to upload the data to the server
      console.log("Sending getData with uploadData=true")
      chrome.runtime.sendMessage({
        action: "getData",
        uploadData: true // This flag indicates we want to upload the data
      })
    } catch (error) {
      importButton.disabled = false
      updateStatus("Error: " + (error.message || "Unknown error"), "error")
    }
  })

  copyButton.addEventListener("click", async function () {
    console.log("Copying...")
    copyButton.disabled = true
  
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
  
      // Ensure we're on a Granblue Fantasy game page
      if (!tab.url.includes("game.granbluefantasy.jp")) {
        updateStatus("Please navigate to a Granblue Fantasy game page", "error")
        copyButton.disabled = false
        return
      }
  
      // Check if we're on a detail page or party page
      const isDetailPage = tab.url.includes("#archive/detail_")
      const isPartyPage = tab.url.includes("#party/")
  
      if (!isDetailPage && !isPartyPage) {
        updateStatus(
          "Please navigate to a party, weapon, character, or summon page to copy.",
          "error"
        )
        copyButton.disabled = false
        return
      }
  
      // For copy button, we just want to fetch the data without uploading
      chrome.runtime.sendMessage({
        action: "getData",
        uploadData: false // This flag indicates we don't want to upload
      })
    } catch (error) {
      copyButton.disabled = false
      updateStatus("Error: " + (error.message || "Unknown error"), "error")
    }
  })
  
  // Handle messages from content script / background
  chrome.runtime.onMessage.addListener((message) => {
    console.log("Popup received message:", message)
  
    if (message.action === "dataFetched") {
      if (message.version) {
        // Update version display if available
        const versionElem = document.querySelector(".version")
        if (versionElem) {
          versionElem.textContent = message.version
        }
      }
  
      // Handle different data types
      const dataType = message.dataType || "unknown"
      
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
          setTimeout(() => {
            resetStatus()
          }, 2000)
          
          // Also copy to clipboard for convenience
          navigator.clipboard
            .writeText(message.data)
            .then(() => {
              console.log("Data also copied to clipboard")
            })
            .catch((err) => {
              console.error("Clipboard error:", err)
            })
            
          importButton.disabled = false
          copyButton.disabled = false
          return // Early return
        }
      }
      
      // If we're here, we're just copying to clipboard (no upload or upload failed)
      navigator.clipboard
        .writeText(message.data)
        .then(() => {
          // Show different success message based on data type
          if (dataType === "party") {
            updateStatus("✓ Party data copied!", "success")
          } else if (dataType === "detail_npc") {
            updateStatus("✓ Character data copied!", "success")
          } else if (dataType === "detail_weapon") {
            updateStatus("✓ Weapon data copied!", "success") 
          } else if (dataType === "detail_summon") {
            updateStatus("✓ Summon data copied!", "success")
          } else {
            updateStatus("✓ Data copied to clipboard!", "success")
          }
          
          setTimeout(() => {
            resetStatus()
          }, 2000)
        })
        .catch((err) => {
          console.error("Clipboard error:", err)
          updateStatus("Failed to copy data", "error")
        })
        .finally(() => {
          importButton.disabled = false
          copyButton.disabled = false
        })
    } else if (message.action === "error") {
      updateStatus(message.error, "error")
      importButton.disabled = false
      copyButton.disabled = false
    } else if (message.action === "urlReady") {
      // Open the URL in a new tab and close the extension
      chrome.tabs.create({ url: message.url }, () => {
        window.close()
      })
    }
  })

  // Initialize the UI based on authentication status.
  refreshAuthUI()
})
