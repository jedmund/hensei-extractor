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
  party: {
    endpoint: "party/deck",
  },
  // List types
  list: {
    weapon: {
      endpoint: "weapon/list/1",
      containerEndpoint: "weapon/container_list",
    },
    summon: {
      endpoint: "summon/list/1",
      containerEndpoint: "summon/container_list",
    },
    npc: {
      endpoint: "npc/list/1",
      containerEndpoint: "npc/container_list",
    },
  },
}

// Standard payloads for different list types
const LIST_PAYLOADS = {
  standard: {
    special_token: null,
    is_new: true,
    status: "",
    use_default: 0,
  },
  container: {
    is_new: false,
    use_default: 0,
  },
}

// Initialize state
let initialized = false

// Function to extract Game.version from existing script tags
function findGameVersion() {
  // Look for script tags containing Game.version
  const scripts = document.getElementsByTagName("script")
  for (const script of scripts) {
    if (script.textContent && script.textContent.includes("Game.version")) {
      const match = script.textContent.match(
        /Game\.version\s*=\s*['"](.*?)['"]/
      )
      if (match) {
        console.log("Found Game.version in script:", match[1])
        return match[1]
      }
    }
  }

  // Look for version in other common places
  const allScripts = document.getElementsByTagName("script")
  const versionRegex = /"version"\s*:\s*"(\d+)"/
  for (const script of allScripts) {
    if (script.textContent) {
      const match = script.textContent.match(versionRegex)
      if (match) {
        console.log("Found version in script:", match[1])
        return match[1]
      }
    }
  }

  // Look for meta tags that might contain version info
  const metas = document.getElementsByTagName("meta")
  for (const meta of metas) {
    if (meta.name === "version" || meta.name === "game-version") {
      console.log("Found version in meta tag:", meta.content)
      return meta.content
    }
  }

  console.log("No version found in page")
  return null
}

// Function to extract info from hash URL
function extractInfoFromHash(hash) {
  // Handle container list URLs
  if (hash.includes("/container/list/")) {
    const parts = hash.split("/")
    const type = parts[3] // weapon, summon, or npc
    const containerId = parts[4]

    if (CONTENT_TYPES.list[type]) {
      return {
        type: "container_list",
        listType: type,
        endpoint: `${CONTENT_TYPES.list[type].containerEndpoint}/1/${containerId}`,
        payload: LIST_PAYLOADS.container,
      }
    }
  }

  // Handle regular list URLs
  if (hash === "#list" || hash.startsWith("#list/")) {
    let type = "weapon" // default to weapon if not specified

    // Check if a specific type is mentioned in the URL
    if (hash.includes("/")) {
      const parts = hash.split("/")
      const requestedType = parts[1]
      if (CONTENT_TYPES.list[requestedType]) {
        type = requestedType
      }
    }

    return {
      type: "standard_list",
      listType: type,
      endpoint: CONTENT_TYPES.list[type].endpoint,
      payload: LIST_PAYLOADS.standard,
    }
  }

  // Handle party URLs
  if (hash.startsWith("#party/")) {
    return {
      type: "party",
      endpoint: CONTENT_TYPES.party.endpoint,
    }
  }

  // Handle existing archive URLs
  if (hash.includes("archive/detail_")) {
    const parts = hash.split("/")
    const type = parts[1]

    return {
      type: type,
      uid: parts[2],
      contentId: parts[6],
      endpoint: CONTENT_TYPES[type]?.endpoint,
      idType: CONTENT_TYPES[type]?.idType,
    }
  }

  return null
}

// Function to update stored info
async function updateStoredInfo() {
  const hash = window.location.hash
  const isListUrl =
    hash === "#list" ||
    hash.startsWith("#list/") ||
    hash.includes("/container/list/")

  if (
    hash.includes("archive/detail_") ||
    hash.startsWith("#party/") ||
    isListUrl
  ) {
    const info = extractInfoFromHash(hash)
    const gameVersion = findGameVersion()

    if (!gameVersion) {
      console.log("No game version found")
      return null
    }

    console.log("Found game version:", gameVersion)

    // Check if we have necessary info based on type
    const hasRequiredInfo =
      info.type === "standard_list" ||
      info.type === "container_list" ||
      info.type === "party" ||
      (info.uid && info.contentId && info.endpoint)

    if (hasRequiredInfo) {
      const state = {
        ...info,
        gameVersion: gameVersion,
        timestamp: Date.now(),
      }

      await chrome.storage.local.set({
        lastContentInfo: state,
      })
      console.log("Stored content info:", state)
      return state
    }
  }
  return null
}

// Initialize the content script
async function initialize() {
  if (initialized) return

  console.log("Initializing content script...")

  // Update stored info
  const info = await updateStoredInfo()

  if (info) {
    // Listen for hash changes
    window.addEventListener("hashchange", updateStoredInfo)
    initialized = true
    console.log("Content script successfully initialized")
  }

  return info
}

// Function to observe DOM changes
function observeDOM() {
  const observer = new MutationObserver((mutations) => {
    if (!initialized) {
      const version = findGameVersion()
      if (version) {
        observer.disconnect()
        initialize()
      }
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

// Start observing DOM changes
observeDOM()

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message)

  // Handle ping messages
  if (message.action === "ping") {
    sendResponse({ status: "ok" })
    return
  }

  if (message.action === "fetchData") {
    chrome.storage.local.get(["lastContentInfo"], async function (result) {
      if (!result.lastContentInfo) {
        // Try to initialize one more time
        const info = await initialize()
        if (!info) {
          chrome.runtime.sendMessage({
            action: "error",
            error:
              "No content data found. Please refresh the page and try again.",
          })
          return
        }
        result.lastContentInfo = info
      }

      try {
        const info = result.lastContentInfo
        const currentTimestamp = Date.now()
        let url

        // Construct URL based on type
        if (info.type === "standard_list" || info.type === "container_list") {
          url = `https://game.granbluefantasy.jp/${info.endpoint}?_=${currentTimestamp}&t=${currentTimestamp}&uid=${window.Game?.userId}`
        } else if (info.type === "party") {
          url = `https://game.granbluefantasy.jp/${info.endpoint}?_=${currentTimestamp}&t=${currentTimestamp}&uid=${window.Game?.userId}`
        } else {
          url = `https://game.granbluefantasy.jp/archive/${info.endpoint}?_=${currentTimestamp}&t=${currentTimestamp}&uid=${info.uid}`
        }

        console.log("Game version:", info.gameVersion)
        console.log("Attempting to fetch:", url)

        const requestOptions = {
          method: info.type === "party" ? "GET" : "POST",
          headers: {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-VERSION": info.gameVersion,
            Origin: "https://game.granbluefantasy.jp",
            Referer: "https://game.granbluefantasy.jp/",
          },
          credentials: "include",
        }

        // Add appropriate payload based on type
        if (info.type !== "party") {
          if (info.type === "standard_list" || info.type === "container_list") {
            requestOptions.body = JSON.stringify(info.payload)
          } else {
            requestOptions.body = JSON.stringify({
              special_token: null,
              user_id: info.uid,
              kind_name: "0",
              attribute: "0",
              event_id: null,
              story_id: null,
              [info.idType]: info.contentId,
            })
          }
        }

        const response = await fetch(url, requestOptions)

        console.log("Response status:", response.status)
        console.log(
          "Response headers:",
          Object.fromEntries(response.headers.entries())
        )

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(
            `HTTP error! status: ${response.status}, response: ${errorText}`
          )
        }

        const data = await response.json()
        chrome.runtime.sendMessage({
          action: "dataFetched",
          data: JSON.stringify(data, null, 2),
          version: info.gameVersion,
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
