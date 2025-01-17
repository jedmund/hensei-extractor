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

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message)

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
