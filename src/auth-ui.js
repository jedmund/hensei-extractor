/**
 * @fileoverview Authentication UI - login, logout, profile display.
 */

import { performLogin, fetchUserInfo } from "../auth.js"
import { getImageUrl, getSiteBaseUrl } from "../constants.js"
import { show, hide, setElementColor, clearElementColors } from "../dom.js"
import { showStatus } from "./helpers.js"

/**
 * Set up login view event listeners
 * @param {function} initializeApp - App initialization callback
 */
export function initializeLoginListeners(initializeApp) {
  const acknowledgeButton = document.getElementById('acknowledgeButton')
  const loginButton = document.getElementById('loginButton')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  acknowledgeButton?.addEventListener('click', () => {
    chrome.storage.local.set({ noticeAcknowledged: true })
    hide(warning)
    show(loginFormContainer)
  })

  loginButton?.addEventListener('click', () => handleLogin(initializeApp))

  document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin(initializeApp)
  })
}

/**
 * Handle login button click
 */
async function handleLogin(initializeApp) {
  const username = document.getElementById('loginUsername').value.trim()
  const password = document.getElementById('loginPassword').value.trim()
  const loginButton = document.getElementById('loginButton')
  const loginStatus = document.getElementById('loginStatus')

  if (!username || !password) {
    showStatus(loginStatus, 'Please enter username and password', 'error')
    return
  }

  loginButton.disabled = true
  showStatus(loginStatus, 'Logging in...', 'info')

  try {
    let gbAuth = await performLogin(username, password)

    const userInfo = await fetchUserInfo(gbAuth.access_token)
    gbAuth = {
      ...gbAuth,
      avatar: userInfo.avatar,
      language: userInfo.language,
      role: userInfo.role || 0
    }

    await chrome.storage.local.set({ gbAuth })

    showStatus(loginStatus, 'Login successful!', 'success')

    setTimeout(() => {
      initializeApp()
    }, 1000)

  } catch (err) {
    console.error('Login error:', err)
    showStatus(loginStatus, err.message || 'Login failed', 'error')
    loginButton.disabled = false
  }
}

/**
 * Handle logout
 */
export async function handleLogout(initializeApp) {
  await chrome.storage.local.remove(['gbAuth'])
  clearElementColors(document.body)
  initializeApp()
}

/**
 * Handle show warning/disclaimer
 */
export function handleShowWarning(initializeApp) {
  const loginView = document.getElementById('loginView')
  const mainView = document.getElementById('mainView')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  show(loginView)
  hide(mainView)
  show(warning)
  hide(loginFormContainer)

  const acknowledgeButton = document.getElementById('acknowledgeButton')
  acknowledgeButton.onclick = () => {
    hide(loginView)
    show(mainView)
    acknowledgeButton.onclick = null
    initializeLoginListeners(initializeApp)
  }
}

/**
 * Update profile UI with user data
 */
export async function updateProfileUI(gbAuth) {
  const tabAvatar = document.getElementById('tabAvatar')
  const profileAvatar = document.getElementById('profileAvatar')
  const profileUsername = document.getElementById('profileUsername')
  const profileHeader = document.getElementById('viewProfile')

  if (profileUsername) {
    profileUsername.textContent = gbAuth.user?.username || 'User'
  }

  const avatarUrl = gbAuth.avatar?.picture
    ? getImageUrl(`profile/${gbAuth.avatar.picture}@2x.png`)
    : getImageUrl('profile/npc@2x.png')

  if (tabAvatar) tabAvatar.src = avatarUrl
  if (profileAvatar) profileAvatar.src = avatarUrl

  if (gbAuth.avatar?.element) {
    setElementColor(document.body, gbAuth.avatar.element)
  }

  if (profileHeader && gbAuth.user?.username) {
    const siteUrl = await getSiteBaseUrl()
    profileHeader.href = `${siteUrl}/${gbAuth.user.username}`
  }
}
