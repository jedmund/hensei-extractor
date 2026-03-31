/**
 * @fileoverview Authentication functions for the Granblue Fantasy Chrome extension.
 * Handles login and user information requests to the Granblue Team API.
 */

import { getApiUrl, getEnvConfig } from './constants.js'

// ==========================================
// AUTHENTICATION
// ==========================================

/**
 * Make an authenticated API request.
 * @param {string} endpoint - API endpoint path
 * @param {string} accessToken - OAuth access token
 * @param {Object} [options] - Additional fetch options (method, body)
 * @returns {Promise<Object>} Parsed JSON response
 */
async function authenticatedFetch(endpoint, accessToken, options = {}) {
  const apiUrl = await getApiUrl(endpoint)
  const headers = { Authorization: `Bearer ${accessToken}` }

  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(apiUrl, {
    method: options.method || 'GET',
    headers,
    ...(options.body && { body: JSON.stringify(options.body) })
  })

  if (!response.ok) {
    const err = new Error(`API request failed: ${response.status}`)
    err.code = 'request_failed'
    throw err
  }

  return response.json()
}

/**
 * Performs the login request to Granblue Team API.
 * Uses the root /oauth/token endpoint (not versioned API path).
 * @param {string} username - User's email address.
 * @param {string} password - User's password.
 * @returns {Promise<Object>} Returns the formatted auth object.
 * @throws {Error} If login fails.
 */
export async function performLogin(username, password) {
  const config = await getEnvConfig()

  const response = await fetch(`${config.apiUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: username,
      password,
      grant_type: 'password'
    })
  })

  if (!response.ok) {
    let code = 'unknown'
    try {
      const errBody = await response.json()
      code = errBody.error || 'unknown'
    } catch (_) {}
    const err = new Error(code)
    err.code = code
    throw err
  }

  const data = await response.json()
  return formatAuthData(data)
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
      username: data.user.username
    }
  }
}

/**
 * Fetches current user's settings from Granblue Team API.
 * @param {string} accessToken - OAuth access token.
 * @returns {Promise<Object>} The user settings object.
 */
export async function fetchUserInfo(accessToken) {
  return authenticatedFetch('/users/me', accessToken)
}

/**
 * Update the user's language preference on the server.
 * @param {string} accessToken - OAuth access token.
 * @param {string} language - Language code ('en' or 'ja').
 * @returns {Promise<Object>} The updated user object.
 */
export async function updateUserLanguage(accessToken, language) {
  return authenticatedFetch('/users/me', accessToken, {
    method: 'PUT',
    body: { user: { language } }
  })
}
