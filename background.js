chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    console.log("Request intercepted:", details.url)
    if (
      details.url.includes("/archive/npc_detail") ||
      details.url.includes("/npc/npc_detail")
    ) {
      console.log("Storing NPC URL:", details.url)
      chrome.storage.local.set({ lastNpcUrl: details.url })
    }
  },
  {
    urls: [
      "https://game.granbluefantasy.jp/archive/npc_detail*",
      "https://game.granbluefantasy.jp/npc/npc_detail*",
    ],
  }
)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message)

  if (message.action === "urlFound") {
    console.log("URL found:", message.url)
    chrome.storage.local.set({ lastNpcUrl: message.url })
  } else if (message.action === "getData") {
    chrome.storage.local.get(["lastNpcUrl"], function (result) {
      console.log("Retrieved stored URL:", result.lastNpcUrl)
      if (result.lastNpcUrl) {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs[0]) {
              console.log("Sending fetchData message to tab:", tabs[0].id)
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "fetchData",
                url: result.lastNpcUrl,
              })
            } else {
              console.error("No active tab found")
            }
          }
        )
      } else {
        console.error("No URL stored")
        chrome.runtime.sendMessage({
          action: "error",
          error:
            "No character data URL found. Please reload the character page.",
        })
      }
    })
  }
  return true
})
