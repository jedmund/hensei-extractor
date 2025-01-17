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
  list: {
    weapon: {
      endpoint: "weapon/list",
      containerEndpoint: "weapon/container_list",
    },
    npc: {
      endpoint: "npc/list",
      containerEndpoint: "npc/container_list",
    },
    summon: {
      endpoint: "summon/list",
      containerEndpoint: "summon/container_list",
    },
  },
}

// Standard payloads
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

// Function to get current page number from URL
function getCurrentPage() {
  const hash = window.location.hash
  if (hash.includes("/list/")) {
    const parts = hash.split("/")
    const possiblePage = parseInt(parts[2])
    if (!isNaN(possiblePage)) {
      return possiblePage
    }
  }
  return 1
}

// Function to extract Game.version from page
function findGameVersion() {
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

  const versionRegex = /"version"\s*:\s*"(\d+)"/
  for (const script of scripts) {
    if (script.textContent) {
      const match = script.textContent.match(versionRegex)
      if (match) {
        console.log("Found version in script:", match[1])
        return match[1]
      }
    }
  }

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

// Function to create info object for list pages
function createListInfo(type) {
  const page = getCurrentPage()
  return {
    type: "standard_list",
    listType: type,
    endpoint: `${CONTENT_TYPES.list[type].endpoint}/${page}`,
    payload: LIST_PAYLOADS.standard,
  }
}

// Function to create info object for detail pages
function createDetailInfo(hash) {
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

// Function to create info object for party pages
function createPartyInfo() {
  return {
    type: "party",
    endpoint: CONTENT_TYPES.party.endpoint,
  }
}

// Function to extract info from hash URL
function extractInfoFromHash(hash, listType = null) {
  // If listType is provided, we're explicitly requesting list data
  if (listType && CONTENT_TYPES.list[listType]) {
    return createListInfo(listType)
  }

  // Otherwise handle based on URL
  if (hash.includes("archive/detail_")) {
    return createDetailInfo(hash)
  }

  if (hash.startsWith("#party/")) {
    return createPartyInfo()
  }

  return null
}

// Function to update stored info
async function updateStoredInfo(listType = null) {
  const hash = window.location.hash
  const info = extractInfoFromHash(hash, listType)
  const gameVersion = findGameVersion()

  if (!gameVersion) {
    console.log("No game version found")
    return null
  }

  if (info) {
    const state = {
      ...info,
      gameVersion: gameVersion,
      timestamp: Date.now(),
    }

    await chrome.storage.local.set({ lastContentInfo: state })
    console.log("Stored content info:", state)
    return state
  }

  return null
}

// Initialize the content script
async function initialize() {
  if (initialized) return

  console.log("Initializing content script...")
  const info = await updateStoredInfo()

  if (info) {
    window.addEventListener("hashchange", () => updateStoredInfo())
    initialized = true
    console.log("Content script successfully initialized")
  }

  return info
}

// Function to create request options
function createRequestOptions(info) {
  const options = {
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

  if (info.type !== "party") {
    if (info.type === "standard_list" || info.type === "container_list") {
      options.body = JSON.stringify(info.payload)
    } else {
      options.body = JSON.stringify({
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

  return options
}

// Function to create request URL
function createRequestUrl(info) {
  const currentTimestamp = Date.now()
  const baseUrl = "https://game.granbluefantasy.jp"
  const userId = window.Game?.userId
  const params = `_=${currentTimestamp}&t=${currentTimestamp}&uid=${
    userId || info.uid
  }`

  if (
    info.type === "standard_list" ||
    info.type === "container_list" ||
    info.type === "party"
  ) {
    return `${baseUrl}/${info.endpoint}?${params}`
  }

  return `${baseUrl}/archive/${info.endpoint}?${params}`
}

// Function to make the API request
async function makeRequest(info) {
  const url = createRequestUrl(info)
  const options = createRequestOptions(info)

  console.log("Making request:", { url, options })
  const response = await fetch(url, options)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
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

  if (message.action === "ping") {
    sendResponse({ status: "ok" })
    return
  }

  if (message.action === "fetchData") {
    chrome.storage.local.get(["lastContentInfo"], async function (result) {
      try {
        // Always update stored info, using listType if provided
        const info = await updateStoredInfo(message.listType)
        if (!info) {
          throw new Error(
            "No content data found. Please refresh the page and try again."
          )
        }

        const data = await makeRequest(info)
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
