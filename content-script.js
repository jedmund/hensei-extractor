console.log("Content script loaded")

// Function to extract info from hash URL
function extractInfoFromHash(hash) {
  // Format: #archive/detail_npc/20725160/0/0/1/3040284000/3/0/archive_npc
  const parts = hash.split("/")
  return {
    uid: parts[2],
    characterId: parts[6],
  }
}

// Function to observe hash changes
function observeChanges() {
  function processHash(hash) {
    if (hash.includes("archive/detail_npc")) {
      const info = extractInfoFromHash(hash)
      if (info.uid && info.characterId) {
        chrome.storage.local.set({
          lastNpcInfo: info,
          timestamp: Date.now(),
        })
        console.log("Stored character info:", info)
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
    chrome.storage.local.get(["lastNpcInfo"], async function (result) {
      if (!result.lastNpcInfo) {
        chrome.runtime.sendMessage({
          action: "error",
          error:
            "No character data found. Please make sure you're on a character page.",
        })
        return
      }

      try {
        const timestamp = Date.now()
        const url = `https://game.granbluefantasy.jp/archive/npc_detail?_=${timestamp}&t=${timestamp}&uid=${result.lastNpcInfo.uid}`

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

        // Create payload matching the game's request
        const payload = {
          special_token: null,
          user_id: result.lastNpcInfo.uid,
          kind_name: "0",
          attribute: "0",
          event_id: null,
          story_id: null,
          character_id: result.lastNpcInfo.characterId,
          style: 1,
        }

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
