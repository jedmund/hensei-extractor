// Function to ensure content script is loaded before sending a message
async function ensureContentScriptLoaded(tabId) {
  try {
    // Ping the content script
    await chrome.tabs.sendMessage(tabId, { action: "ping" })
    return true
  } catch (error) {
    console.log("Content script not loaded, injecting...")
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content-script.js"],
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    return true
  }
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender) => {
  console.log("Background received message:", message)

  if (message.action === "getData") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          await ensureContentScriptLoaded(tabs[0].id)

          // Forward the request to the content script,
          // including listType and pageNumber if provided
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: "fetchData",
            listType: message.listType || null,
            pageNumber: message.pageNumber || null,
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
    })
  }

  return true
})
