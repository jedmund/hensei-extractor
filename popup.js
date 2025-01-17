console.log("Popup script loaded")

document.addEventListener("DOMContentLoaded", function () {
  const copyButton = document.getElementById("copyData")
  const copyWeaponButton = document.getElementById("copyWeapon")
  const copyCharacterButton = document.getElementById("copyCharacter")
  const copySummonButton = document.getElementById("copySummon")
  const status = document.getElementById("status")
  const singleButton = document.getElementById("singleButton")
  const listButtons = document.getElementById("listButtons")
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

  async function setupButtonVisibility() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.url.includes("game.granbluefantasy.jp")) {
      updateStatus("Please navigate to a Granblue Fantasy game page", "error")
      return
    }

    // Show list buttons if we're on a list page
    if (tab.url.includes("#list")) {
      singleButton.style.display = "none"
      listButtons.style.display = "flex"
    } else {
      singleButton.style.display = "block"
      listButtons.style.display = "none"
    }
  }

  // Setup initial visibility
  setupButtonVisibility()

  // Function to handle list data copying
  async function copyListData(type) {
    const button = {
      weapon: copyWeaponButton,
      npc: copyCharacterButton,
      summon: copySummonButton,
    }[type]

    button.disabled = true
    updateStatus("Fetching data...", "info")

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })

      if (!tab.url.includes("game.granbluefantasy.jp")) {
        updateStatus("Please navigate to a Granblue Fantasy game page", "error")
        button.disabled = false
        return
      }

      // Send the message to content script with explicit listType
      await chrome.tabs.sendMessage(tab.id, {
        action: "fetchData",
        listType: type, // Make sure this is being sent
      })
    } catch (error) {
      updateStatus("Failed to access tab information", "error")
      button.disabled = false
    }
  }

  // Add click handlers for list buttons
  copyWeaponButton.addEventListener("click", () => copyListData("weapon"))
  copyCharacterButton.addEventListener("click", () => copyListData("npc"))
  copySummonButton.addEventListener("click", () => copyListData("summon"))

  // Original copy button handler
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

  // Handle messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
          copyWeaponButton.disabled = false
          copyCharacterButton.disabled = false
          copySummonButton.disabled = false
        })
    } else if (message.action === "error") {
      updateStatus(message.error, "error")
      copyButton.disabled = false
      copyWeaponButton.disabled = false
      copyCharacterButton.disabled = false
      copySummonButton.disabled = false
    }
  })
})
