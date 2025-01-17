// Listen for web requests
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    console.log("Request intercepted:", details.url)
    if (
      details.url.includes("/archive/npc_detail") ||
      details.url.includes("/npc/npc_detail") ||
      details.url.includes("/party/deck")
    ) {
      console.log("Storing URL:", details.url)
      chrome.storage.local.set({
        lastUrl: details.url,
        lastUrlType: details.url.includes("party/deck") ? "party" : "npc",
      })
    }
  },
  {
    urls: [
      "https://game.granbluefantasy.jp/archive/npc_detail*",
      "https://game.granbluefantasy.jp/npc/npc_detail*",
      "https://game.granbluefantasy.jp/party/deck*",
    ],
  }
)

// Function to ensure content script is loaded before sending message
async function ensureContentScriptLoaded(tabId) {
  try {
    // Check if the content script is already loaded
    await chrome.tabs.sendMessage(tabId, { action: "ping" })
    return true
  } catch (error) {
    // If not loaded, inject it
    console.log("Content script not loaded, injecting...")
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content-script.js"],
    })

    // Wait a bit for the script to initialize
    await new Promise((resolve) => setTimeout(resolve, 500))
    return true
  }
}

async function getUserIdFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Try different ways to get the user ID
        if (window.Game && window.Game.userId) {
          return window.Game.userId
        }

        // Try getting from script tags
        const scripts = document.getElementsByTagName("script")
        for (const script of scripts) {
          if (script.textContent) {
            const match = script.textContent.match(
              /Game\.userId\s*=\s*['"](.*?)['"]/
            )
            if (match) {
              return match[1]
            }
            // Also try JSON format
            const jsonMatch = script.textContent.match(
              /"user_id"\s*:\s*"(\d+)"/
            )
            if (jsonMatch) {
              return jsonMatch[1]
            }
          }
        }

        // Try getting from URL
        const urlParams = new URLSearchParams(window.location.search)
        const uid = urlParams.get("uid")
        if (uid) {
          return uid
        }

        // Try getting from any meta tags
        const metas = document.getElementsByTagName("meta")
        for (const meta of metas) {
          if (meta.name === "user-id" || meta.name === "uid") {
            return meta.content
          }
        }

        return null
      },
    })

    console.log("User ID detection results:", results)
    return results[0].result
  } catch (error) {
    console.error("Error executing script:", error)
    return null
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message)

  if (message.action === "getUserId") {
    console.log("Getting user ID for tab:", sender.tab.id)
    getUserIdFromTab(sender.tab.id)
      .then((userId) => {
        console.log("Found user ID:", userId)
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "userIdReceived",
          userId: userId,
        })
      })
      .catch((error) => {
        console.error("Error getting user ID:", error)
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "userIdError",
          error: error.message,
        })
      })
  }

  if (message.action === "getData") {
    chrome.tabs.query(
      { active: true, currentWindow: true },
      async function (tabs) {
        if (tabs[0]) {
          try {
            // Ensure content script is loaded before sending message
            await ensureContentScriptLoaded(tabs[0].id)

            // Get the current URL from the tab
            const currentUrl = tabs[0].url
            console.log("Current tab URL:", currentUrl)

            // Send the fetchData message to the content script
            await chrome.tabs.sendMessage(tabs[0].id, {
              action: "fetchData",
            })
          } catch (error) {
            console.error("Error sending message:", error)
            chrome.runtime.sendMessage({
              action: "error",
              error:
                "Failed to communicate with page. Please refresh and try again.",
            })
          }
        } else {
          console.error("No active tab found")
          chrome.runtime.sendMessage({
            action: "error",
            error: "No active game tab found.",
          })
        }
      }
    )
  }

  return true
})
