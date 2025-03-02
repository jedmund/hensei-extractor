/**
 * @fileoverview Content script for the Granblue Fantasy Chrome extension.
 * This script is injected into the Granblue Fantasy game page. It extracts game
 * information (such as version and user ID), builds request data based on the URL hash,
 * listens for DOM and hash changes, makes API requests to fetch game details or party data,
 * and uploads party data to Granblue Team. It also communicates with the background and popup
 * scripts via chrome.runtime messaging.
 */

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
 * Searches for the game version within script tags or meta tags in the document.
 * @returns {string|null} The found game version, or null if not found.
 */
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
 * @returns {string|null} The user ID if found, or null otherwise.
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

/**
 * Creates an info object for list pages based on type and page number.
 * @param {string} type - The list type (e.g., 'weapon', 'npc', 'summon').
 * @param {number} [pageNumber] - The page number to use; if not provided, retrieves from URL.
 * @returns {Object} The info object for the list page.
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
 * Creates an info object for detail pages based on the URL hash.
 * @param {string} hash - The URL hash string.
 * @returns {Object} The info object for a detail page.
 */
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

/**
 * Creates an info object for party pages.
 * @returns {Object} The info object for a party page.
 */
function createPartyInfo() {
  return {
    type: "party",
    endpoint: CONTENT_TYPES.party.endpoint,
  }
}

/**
 * Extracts information from the URL hash to determine which API request to make.
 * @param {string} hash - The current URL hash.
 * @param {string|null} [listType=null] - Optional list type for list pages.
 * @param {number|null} [pageNumber=null] - Optional page number for list pages.
 * @returns {Object|null} The extracted info object or null if none applies.
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
 * Updates the stored content info in chrome.storage.local based on the current URL hash.
 * @param {string|null} [listType=null] - Optional list type for list pages.
 * @param {number|null} [pageNumber=null] - Optional page number for list pages.
 * @returns {Promise<Object|null>} The updated info object, or null if no info found.
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
 * Initializes the content script by updating stored info and adding a hashchange listener.
 * @returns {Promise<Object|null>} The info object if initialization was successful.
 */
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

/**
 * Creates request options for the API call based on the info object.
 * @param {Object} info - The info object containing details about the API request.
 * @returns {Object} The options object for the fetch call.
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

/**
 * Creates the URL for the API request based on the info object.
 * @param {Object} info - The info object containing details about the API request.
 * @returns {string} The fully constructed request URL with query parameters.
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
 * Makes an API request based on the provided info object.
 * @param {Object} info - The info object containing details about the API request.
 * @returns {Promise<Object>} A promise resolving to the JSON response.
 * @throws {Error} Throws an error if the HTTP response is not OK.
 */
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
        initialize()
      }
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

/**
 * Makes an API request using authentication information from chrome.storage.
 * @param {string} url - The URL to send the request to.
 * @param {Object} requestBody - The body of the request.
 * @returns {Promise<Response>} The fetch response promise.
 * @throws {Error} Throws an error if no authentication token is found.
 */
async function makeRequestWithAuth(url, requestBody) {
  const { gbAuth } = await chrome.storage.local.get(["gbAuth"])
  if (!gbAuth || !gbAuth.access_token) {
    throw new Error("Not authenticated; no token available.")
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${gbAuth.access_token}`,
  }

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  })
}

/**
 * Uploads party data to the Granblue Team API.
 * @param {Object} payload - The payload containing the party data.
 * @returns {Promise<Object|null>} The API response data if successful, or null if not authenticated.
 * @throws {Error} Throws an error if the upload request fails.
 */
async function uploadDataToGranblueTeam(payload) {
  // Load your stored auth info from local storage
  const { gbAuth } = await chrome.storage.local.get(["gbAuth"])
  if (!gbAuth || !gbAuth.access_token) {
    console.warn("No auth token found; cannot upload party data.")
    return null
  }

  // Make the POST request
  const response = await fetch("https://api.granblue.team/api/v1/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gbAuth.access_token}`, // Important
    },
    body: JSON.stringify({
      import: payload, // The server expects a top-level "import" key
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

// Start observing DOM changes
observeDOM()

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message)

  if (message.action === "ping") {
    sendResponse({ status: "ok" })
    return
  }

  if (message.action === "fetchData") {
    chrome.storage.local.get(["lastContentInfo"], async function () {
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

        const data = await makeRequest(info)

        if (info.type === "party") {
          // Or, if you want to post for everything, remove this check
          await uploadDataToGranblueTeam(data)
        }

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
