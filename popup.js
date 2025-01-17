console.log("Popup script loaded")

document.addEventListener("DOMContentLoaded", function () {
  const copyButton = document.getElementById("copyData")
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

  // Check for stored version on popup open
  chrome.storage.local.get(["lastContentInfo"], function (result) {
    if (result.lastContentInfo?.gameVersion) {
      updateVersion(result.lastContentInfo.gameVersion)
    }
  })

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

      chrome.runtime.sendMessage({ action: "getData" })
    } catch (error) {
      updateStatus("Failed to access tab information", "error")
      copyButton.disabled = false
    }
  })

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Popup received message:", message)

    if (message.action === "dataFetched") {
      // Update version if available in the message
      if (message.version) {
        updateVersion(message.version)
      }

      navigator.clipboard
        .writeText(message.data)
        .then(() => {
          updateStatus("✅ Data copied to clipboard!", "success")
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
