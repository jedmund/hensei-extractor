/**
 * Performs the login request.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>} Returns the gbAuth object.
 */
export async function performLogin(username, password) {
  const response = await fetch("https://api.granblue.team/oauth/token", {
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
 * Fetches additional user information.
 * @param {string} username
 * @param {string} accessToken
 * @returns {Promise<Object>} The user info object.
 */
export async function fetchUserInfo(username, accessToken) {
  const response = await fetch(
    `https://api.granblue.team/v1/users/info/${username}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    console.error("[fetchUserInfo] Error fetching user info:", error)
    throw error
  }
  return await response.json()
}
