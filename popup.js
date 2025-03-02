import { performLogin, fetchUserInfo } from "./auth.js"
import {
  updateAvatarImage,
  updateMainMessage,
  resetMainMessage,
  refreshAuthUI,
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
      // Ensure the current page is a party page
      if (!tab.url.includes("#party/")) {
        updateStatus(
          "Not a party page. Please navigate to a party page to import.",
          "error"
        )
        importButton.disabled = false
        return
      }

      // Send a message to background.js (which will forward to the content script)
      chrome.runtime.sendMessage({
        action: "getData",
      })
    } catch (error) {
      importButton.disabled = false
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
        importButton.disabled = false
        return
      }
      // Ensure the current page is a party page
      if (!tab.url.includes("#party/")) {
        updateStatus(
          "Not a party page. Please navigate to a party page to import.",
          "error"
        )
        importButton.disabled = false
        return
      }

      // Send a message to background.js (which will forward to the content script)
      chrome.runtime.sendMessage({
        action: "getData",
      })
    } catch (error) {
      importButton.disabled = false
    }
  })

  // Handle messages from content script / background
  chrome.runtime.onMessage.addListener((message) => {
    console.log("Popup received message:", message)

    if (message.action === "dataFetched") {
      if (message.version) {
        updateVersion(message.version)
      }

      navigator.clipboard
        .writeText(message.data)
        .then(() => {
          updateStatus("\u2714 Data copied to clipboard!", "success")
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
        })
    } else if (message.action === "error") {
      updateStatus(message.error, "error")
      importButton.disabled = false
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
