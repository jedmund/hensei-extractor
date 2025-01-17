console.log("Popup script loaded")

document.addEventListener("DOMContentLoaded", function () {
  const copyButton = document.getElementById("copyData")
  const dataTypeSelect = document.getElementById("dataTypeSelect")
  const pageNumberInput = document.getElementById("pageNumberInput")
  const listControls = document.getElementById("listControls")
  const status = document.getElementById("status")
  const versionDisplay = document.getElementById("version")

  function updateStatus(message, type = "info") {
    status.style.display = "block"
    status.textContent = message
    status.className = `status-${type}`
  }

  function resetStatus() {
    status.style.display = "none"
    status.textContent = ""
    status.className = ""
  }

  function updateVersion(version) {
    if (version) {
      versionDisplay.textContent = `v${version}`
    } else {
      versionDisplay.textContent = "..."
    }
  }

  async function setupUI() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.url.includes("game.granbluefantasy.jp")) {
      updateStatus("Please navigate to a Granblue Fantasy game page", "error")
      copyButton.disabled = true
      return
    }

    // If the URL has "#list" in it, show the dropdown + page input
    if (tab.url.includes("#list")) {
      listControls.style.display = "flex" // show
    } else {
      listControls.style.display = "none" // hide
    }
  }

  // Setup initial UI based on the current tab
  setupUI()

  copyButton.addEventListener("click", async function () {
    copyButton.disabled = true
    updateStatus("Fetching data...", "info")

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (!tab.url.includes("game.granbluefantasy.jp")) {
        updateStatus("Please navigate to a Granblue Fantasy game page", "error")
        copyButton.disabled = false
        return
      }

      // If the list controls are visible, we assume we’re on a list page
      // so we pass both the data type and the page number.
      let listType = null
      let pageNumber = null
      if (listControls.style.display === "flex") {
        listType = dataTypeSelect.value
        pageNumber = parseInt(pageNumberInput.value) || 1
      }

      // Send a message to background.js (which will forward to the content script)
      chrome.runtime.sendMessage({
        action: "getData",
        listType,
        pageNumber,
      })
    } catch (error) {
      updateStatus("Failed to access tab information", "error")
      copyButton.disabled = false
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
          copyButton.disabled = false
        })
    } else if (message.action === "error") {
      updateStatus(message.error, "error")
      copyButton.disabled = false
    }
  })
})
