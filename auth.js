/**
 * @fileoverview Authentication functions for the Granblue Fantasy Chrome extension.
 * Handles login and user information requests to the Granblue Team API.
 */

import { getApiBaseUrl } from './constants.js'

// Re-export for backward compatibility
export { getApiBaseUrl } from './constants.js'

// ==========================================
// AUTHENTICATION
// ==========================================

/**
 * Performs the login request to Granblue Team API.
 * @param {string} username - User's email address.
 * @param {string} password - User's password.
 * @returns {Promise<Object>} Returns the formatted auth object.
 * @throws {Error} If login fails.
 */
export async function performLogin(username, password) {
  // Get the selected site from storage
  const { selectedSite } = await chrome.storage.local.get("selectedSite")
  const apiUrl = getApiBaseUrl(selectedSite)

  try {
    const response = await fetch(`${apiUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: username,
        password,
        grant_type: "password",
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Login failed: ${errText}`)
    }

    const data = await response.json()
    return formatAuthData(data)
  } catch (error) {
    console.error("Login error:", error)
    throw error
  }
}

/**
 * Formats the raw auth data into a more usable structure.
 * @param {Object} data - Raw auth data from the API.
 * @returns {Object} Formatted auth object with token and user info.
 */
function formatAuthData(data) {
  const nowMs = Date.now()
  const expiresMs = nowMs + data.expires_in * 1000

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_at: expiresMs,
    refresh_token: data.refresh_token,
    user: {
      id: data.user.id,
      username: data.user.username,
    },
  }
}

/**
 * Fetches additional user information from Granblue Team API.
 * @param {string} username - User's username.
 * @param {string} accessToken - OAuth access token.
 * @returns {Promise<Object>} The user info object.
 * @throws {Error} If the request fails.
 */
export async function fetchUserInfo(username, accessToken) {
  // Get the selected site from storage
  const { selectedSite } = await chrome.storage.local.get("selectedSite")
  const apiUrl = getApiBaseUrl(selectedSite)

  try {
    const response = await fetch(
      `${apiUrl}/v1/users/info/${username}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching user info:", error)
    throw error
  }
}