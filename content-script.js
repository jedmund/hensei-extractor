console.log("Content script loaded")

// Constants for the different types
const CONTENT_TYPES = {
  detail_npc: {
    endpoint: "npc_detail",
    idType: "character_id",
  },
  detail_weapon: {
    endpoint: "weapon_detail",
    idType: "weapon_id",
  },
  detail_summon: {
    endpoint: "summon_detail",
    idType: "summon_id",
  },
}

// Function to extract info from hash URL
function extractInfoFromHash(hash) {
  // Format: #archive/detail_xxx/20725160/0/0/1/1040506000/1/0
  const parts = hash.split("/")
  const type = parts[1] // detail_npc, detail_weapon, or detail_summon

  return {
    type: type,
    uid: parts[2],
    contentId: parts[6],
    endpoint: CONTENT_TYPES[type]?.endpoint,
    idType: CONTENT_TYPES[type]?.idType,
  }
}

// Function to observe hash changes
function observeChanges() {
  function processHash(hash) {
    if (hash.includes("archive/detail_")) {
      const info = extractInfoFromHash(hash)
      if (info.uid && info.contentId && info.endpoint) {
        chrome.storage.local.set({
          lastContentInfo: info,
          timestamp: Date.now(),
        })
        console.log("Stored content info:", info)
      }
    }
  }

  // Listen for hash changes
  window.addEventListener("hashchange", () => processHash(window.location.hash))

  // Check on initial load
  processHash(window.location.hash)
}

// Initialize observer
observeChanges()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message)

  if (message.action === "fetchData") {
    chrome.storage.local.get(["lastContentInfo"], async function (result) {
      if (!result.lastContentInfo) {
        chrome.runtime.sendMessage({
          action: "error",
          error:
            "No content data found. Please make sure you're on a character, weapon, or summon page.",
        })
        return
      }

      try {
        const info = result.lastContentInfo
        const timestamp = Date.now()
        const url = `https://game.granbluefantasy.jp/archive/${info.endpoint}?_=${timestamp}&t=${timestamp}&uid=${info.uid}`

        console.log("Attempting to fetch:", url)

        // Get version from page script
        let version = "1736851064" // fallback version
        const scripts = document.getElementsByTagName("script")
        for (const script of scripts) {
          if (
            script.textContent &&
            script.textContent.includes("Game.version")
          ) {
            const match = script.textContent.match(
              /Game\.version\s*=\s*['"](.*?)['"]/
            )
            if (match) {
              version = match[1]
              break
            }
          }
        }

        // Create headers matching the game's request exactly
        const headers = {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          Connection: "keep-alive",
          "Content-Type": "application/json",
          Origin: "https://game.granbluefantasy.jp",
          Referer: "https://game.granbluefantasy.jp/",
          "X-Requested-With": "XMLHttpRequest",
          "X-VERSION": version,
        }

        // Create base payload
        const payload = {
          special_token: null,
          user_id: info.uid,
          kind_name: "0",
          attribute: "0",
          event_id: null,
          story_id: null,
        }

        // Add the specific ID based on content type
        payload[info.idType] = info.contentId

        console.log("Using payload:", payload)

        // Make the request
        const response = await fetch(url, {
          method: "POST",
          headers: headers,
          credentials: "include",
          mode: "same-origin",
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const text = await response.text()
        const data = JSON.parse(text)

        chrome.runtime.sendMessage({
          action: "dataFetched",
          data: JSON.stringify(data, null, 2),
        })
      } catch (error) {
        console.error("Fetch error:", error)
        chrome.runtime.sendMessage({
          action: "error",
          error: error.message || "Network request failed",
        })
      }
    })
  }
  return true
})
