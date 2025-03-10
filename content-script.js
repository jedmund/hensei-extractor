/**
 * @fileoverview Content script for the Granblue Fantasy Chrome extension.
 * This script is injected into the Granblue Fantasy game page to extract data.
 */

// ==========================================
// CONSTANTS
// ==========================================

// API endpoints for different content types
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

// Default payloads for list requests
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

// ==========================================
// STATE
// ==========================================

let initialized = false

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Entry point: Sets up the content script
 */
function init() {
  console.log("Setting up content script observer...")
  observeDOM()

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener(handleMessages)
}

/**
 * Observes DOM mutations to detect when the page's game version becomes available,
 * then initializes the content script.
 */
function observeDOM() {
  const observer = new MutationObserver((mutations) => {
    if (!initialized) {
      const version = findGameVersion()
      if (version) {
        observer.disconnect()
        setupContentScript()
      }
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

/**
 * Sets up the content script by storing initial info and adding event listeners
 */
async function setupContentScript() {
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

// ==========================================
// MESSAGE HANDLING
// ==========================================

/**
 * Handles incoming messages from popup or background script
 */
function handleMessages(message, sender, sendResponse) {
  console.log("Content script received message:", message)

  if (message.action === "ping") {
    sendResponse({ status: "ok" })
    return
  }

  if (message.action === "fetchData") {
    handleFetchDataRequest(message)
  }
  return true
}

/**
 * Handles data fetch requests from the popup
 */
async function handleFetchDataRequest(message) {
  try {
    // Always update stored info, using listType if provided
    const info = await updateStoredInfo(
      message.listType,
      message.pageNumber
    )
    
    if (!info) {
      throw new Error(
        "No content data found. Please refresh the page and try again."
      )
    }

    const data = await fetchGameData(info)
    let uploadResult = null

    // Handle different data types
    if (info.type === "party") {
      // For party pages, upload to Granblue.team if requested
      if (message.uploadData) {
        uploadResult = await uploadPartyData(data)
      }
    } else if (info.type.startsWith("detail_")) {
      // For detail pages, upload to appropriate endpoint if requested
      if (message.uploadData) {
        console.log(`Uploading ${info.type} data`)
        uploadResult = await uploadDetailData(data, info.type)
      } else {
        console.log(`Fetched ${info.type} data (no upload)`)
      }
    }

    sendDataToPopup(data, uploadResult, info)
  } catch (error) {
    console.error("Fetch error:", error)
    chrome.runtime.sendMessage({
      action: "error",
      error: error.message || "Network request failed",
    })
  }
}

/**
 * Sends fetched data back to the popup
 */
function sendDataToPopup(data, uploadResult, info) {
  chrome.runtime.sendMessage({
    action: "dataFetched",
    data: JSON.stringify(data, null, 2),
    uploadResult: uploadResult,
    version: info.gameVersion,
    dataType: info.type
  })
}

// ==========================================
// DATA EXTRACTION
// ==========================================

/**
 * Updates the stored content info in chrome.storage.local based on the current URL hash.
 */
async function updateStoredInfo(listType = null, pageNumber = null) {
  const hash = window.location.hash
  const info = extractInfoFromHash(hash, listType, pageNumber)
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

/**
 * Extracts information from the URL hash to determine which API request to make.
 */
function extractInfoFromHash(hash, listType = null, pageNumber = null) {
  // If listType is provided, we're explicitly requesting list data
  if (listType && CONTENT_TYPES.list[listType]) {
    return createListInfo(listType, pageNumber)
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

/**
 * Retrieves the current page number from the window's location hash.
 * @returns {number} The current page number, or 1 if not found.
 */
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

/**
 * Creates an info object for list pages
 */
function createListInfo(type, pageNumber) {
  const page = pageNumber || getCurrentPage()
  return {
    type: "standard_list",
    listType: type,
    endpoint: `${CONTENT_TYPES.list[type].endpoint}/${page}`,
    payload: LIST_PAYLOADS.standard,
  }
}

/**
 * Creates an info object for detail pages
 */
function createDetailInfo(hash) {
  const parts = hash.split("/")
  const type = parts[1]
  // Make sure we have a content ID
  const contentId = parts[6] || null
  if (!contentId) {
    console.error("No content ID found in URL:", hash)
  }
  
  return {
    type: type,
    uid: parts[2],
    contentId: contentId,
    endpoint: CONTENT_TYPES[type]?.endpoint,
    idType: CONTENT_TYPES[type]?.idType,
  }
}

/**
 * Creates an info object for party pages
 */
function createPartyInfo() {
  return {
    type: "party",
    endpoint: CONTENT_TYPES.party.endpoint,
  }
}

/**
 * Retrieves the current page number from the window's location hash.
 */
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

/**
 * Searches for the game version within script tags or meta tags in the document.
 */
function findGameVersion() {
  // Try to find version in script with Game.version
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

  // Fallback: look for "version" : "123" style
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

  // Fallback: meta tag
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

/**
 * Extracts the user ID from the server-props element in the document.
 */
function findUserIdFromServerProps() {
  const serverProps = document.getElementById("server-props")
  if (serverProps && serverProps.textContent) {
    try {
      const data = JSON.parse(serverProps.textContent)
      if (data.userId) {
        console.log("Found userId in server-props:", data.userId)
        return data.userId
      }
    } catch (error) {
      console.error("Error parsing server-props JSON:", error)
    }
  }
  return null
}

// ==========================================
// API REQUESTS
// ==========================================

/**
 * Fetches game data from the Granblue Fantasy API
 */
async function fetchGameData(info) {
  const url = createRequestUrl(info)
  const options = createRequestOptions(info)

  console.log("Making request:", { url, options })
  const response = await fetch(url, options)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Creates the URL for the API request based on the info object.
 */
function createRequestUrl(info) {
  const currentTimestamp = Date.now()
  const baseUrl = "https://game.granbluefantasy.jp"

  // Use the user ID from server-props if available; fallback to window.Game?.userId or info.uid
  const userIdFromProps = findUserIdFromServerProps()
  const userId = userIdFromProps || window.Game?.userId || info.uid

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

/**
 * Creates request options for the API call based on the info object.
 */
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

// ==========================================
// DATA UPLOAD
// ==========================================

/**
 * Uploads party data to the Granblue Team API.
 */
async function uploadPartyData(data) {
  const { gbAuth } = await chrome.storage.local.get(["gbAuth"])
  if (!gbAuth || !gbAuth.access_token) {
    console.warn("No auth token found; cannot upload party data.")
    return null
  }

  const response = await fetch("https://api.granblue.team/v1/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gbAuth.access_token}`,
    },
    body: JSON.stringify({
      import: data, // The server expects a top-level "import" key
    }),
  })

  if (response.ok) {
    const result = await response.json()

    // Compile the final URL and send it back to the popup
    const finalUrl = `https://granblue.team/p/${result.shortcode}`
    chrome.runtime.sendMessage({
      action: "urlReady",
      url: finalUrl,
      shortcode: result.shortcode,
    })

    console.log("Import success:", result)
    return result
  } else {
    const errorText = await response.text()
    throw new Error(`Import request failed (${response.status}): ${errorText}`)
  }
}

/**
 * Uploads detail data (weapon, character, summon) to Granblue Team API.
 */
async function uploadDetailData(data, type) {
  const { gbAuth } = await chrome.storage.local.get(["gbAuth"])
  if (!gbAuth || !gbAuth.access_token) {
    console.warn("No auth token found; cannot upload detail data.")
    return { error: "Not authenticated; please log in to upload data." }
  }

  // Map content type to endpoint
  let endpoint
  if (type === "detail_npc") {
    endpoint = "characters"
  } else if (type === "detail_weapon") {
    endpoint = "weapons"
  } else if (type === "detail_summon") {
    endpoint = "summons"
  } else {
    console.error(`Unknown detail type: ${type}`)
    return { error: `Unknown detail type: ${type}` }
  }

  // Determine language from game data or fall back to user preference
  let lang = "en"
  if (data.cjs && data.cjs.includes("_jp/")) {
    lang = "jp"
  } else if (gbAuth.language === "ja") {
    lang = "jp"
  }

  console.log(`Uploading ${endpoint} data with language: ${lang}`)

  const response = await fetch(`https://api.granblue.team/v1/import/${endpoint}?lang=${lang}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gbAuth.access_token}`
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Import request failed (${response.status}):`, errorText)
    return { error: `Failed to upload data (${response.status}): ${errorText}` }
  }

  const result = await response.json()
  return result
}

// Start the content script
init()
