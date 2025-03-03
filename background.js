/**
 * @fileoverview Background script for the Granblue Fantasy Chrome extension.
 * This script listens for messages from the popup and ensures that the content script
 * is loaded into the active tab before forwarding requests. If the content script is not loaded,
 * it injects it into the page and then forwards the message.
 */

/**
 * Ensures the content script is loaded in the tab by pinging it.
 * If not loaded, injects the content script.
 * @param {number} tabId - The ID of the tab to check/inject.
 * @returns {Promise<boolean>} Resolves to true when the content script is loaded.
 */
async function ensureContentScriptLoaded(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: "ping" })
    return true
  } catch (error) {
    console.log("Content script not loaded, injecting...")
    
    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content-script.js"],
    })
    
    // Wait a moment for the script to initialize
    await new Promise((resolve) => setTimeout(resolve, 500))
    return true
  }
}

/**
 * Handles the getData action from the popup.
 * Ensures content script is loaded and forwards the message.
 * @param {Object} message - The message from the popup.
 */
async function handleGetDataRequest(message) {
  // Find the active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const activeTab = tabs[0]
  
  if (!activeTab) {
    console.error("No active tab found")
    chrome.runtime.sendMessage({
      action: "error",
      error: "No active game tab found.",
    })
    return
  }
  
  try {
    // Make sure content script is loaded
    await ensureContentScriptLoaded(activeTab.id)
    
    // Forward the request to the content script
    console.log("Background forwarding message with uploadData:", message.uploadData)
    await chrome.tabs.sendMessage(activeTab.id, {
      action: "fetchData",
      uploadData: message.uploadData,
      listType: message.listType || null,
      pageNumber: message.pageNumber || null,
    })
  } catch (error) {
    console.error("Error sending message:", error)
    chrome.runtime.sendMessage({
      action: "error",
      error: "Failed to communicate with page. Please refresh and try again.",
    })
  }
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message)

  if (message.action === "getData") {
    handleGetDataRequest(message)
  } else if (message.action === "urlReady") {
    // Forward the urlReady message back to the popup
    chrome.runtime.sendMessage(message)
  }

  // Required for async message handling
  return true
})