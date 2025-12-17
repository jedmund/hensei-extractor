/**
 * @fileoverview Main entry point for the panel script.
 * Initializes the app, sets up event listeners, and wires modules together.
 */

import { getImageUrl } from "../constants.js"
import { show, hide } from "../dom.js"

// Module imports
import { activeTab, switchTab, updateTabVisibility } from "./tabs.js"
import { showDetailView, hideDetailView, isDetailViewActive, getCurrentDetailDataType } from "./detail.js"
import { initializeFilterListeners, refreshDetailViewWithNewData } from "./filter.js"
import { handleSelectAll, handleUnselectAll } from "./selection.js"
import { handleDetailCopy, handleDetailImport } from "./data.js"
import {
  initializeLoginListeners,
  handleLogout,
  handleShowWarning,
  updateProfileUI
} from "./auth-ui.js"
import {
  cachedStatus,
  refreshAllCaches,
  updateTabCacheDisplay,
  handleClearCache
} from "./cache-ui.js"
import { createMessageHandler } from "./messages.js"

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // Set CSS variables for images
  document.documentElement.style.setProperty(
    '--login-bg-image',
    `url('${getImageUrl('port-breeze.jpg')}')`
  )

  initializeApp()
})

/**
 * Initialize the app based on auth state
 */
async function initializeApp() {
  const { gbAuth, noticeAcknowledged } = await chrome.storage.local.get([
    'gbAuth',
    'noticeAcknowledged'
  ])

  const loginView = document.getElementById('loginView')
  const mainView = document.getElementById('mainView')
  const warning = document.getElementById('warning')
  const loginFormContainer = document.getElementById('loginFormContainer')

  if (gbAuth?.access_token) {
    // User is logged in - show main view
    hide(loginView)
    show(mainView)

    updateProfileUI(gbAuth)
    updateTabVisibility(gbAuth.role)
    initializeEventListeners()
    refreshAllCaches()
  } else {
    // User not logged in - show login view
    show(loginView)
    hide(mainView)

    if (noticeAcknowledged) {
      hide(warning)
      show(loginFormContainer)
    } else {
      show(warning)
      hide(loginFormContainer)
    }

    initializeLoginListeners(initializeApp)
  }

  // Set up message listener
  const messageHandler = createMessageHandler({
    refreshAllCaches,
    refreshDetailViewWithNewData: () => refreshDetailViewWithNewData(refreshAllCaches, cachedStatus),
    detailViewActive: isDetailViewActive,
    currentDetailDataType: getCurrentDetailDataType
  })
  chrome.runtime.onMessage.addListener(messageHandler)
}

/**
 * Set up main view event listeners
 */
function initializeEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab, updateTabCacheDisplay, cachedStatus)
    })
  })

  // Profile actions
  document.getElementById('logoutButton')?.addEventListener('click', () => handleLogout(initializeApp))
  document.getElementById('clearCacheButton')?.addEventListener('click', () => handleClearCache(activeTab))
  document.getElementById('showWarning')?.addEventListener('click', () => handleShowWarning(initializeApp))

  // Detail view buttons
  document.getElementById('detailBack')?.addEventListener('click', hideDetailView)
  document.getElementById('detailCopy')?.addEventListener('click', () => handleDetailCopy(getCurrentDetailDataType()))
  document.getElementById('detailImport')?.addEventListener('click', () => handleDetailImport(getCurrentDetailDataType()))

  // Rarity filter
  initializeFilterListeners()

  // Selection bar buttons
  document.getElementById('selectAllBtn')?.addEventListener('click', handleSelectAll)
  document.getElementById('unselectAllBtn')?.addEventListener('click', handleUnselectAll)

  // Update cache display with detail view callback
  const showDetail = (dataType) => showDetailView(dataType, cachedStatus, activeTab)
  updateTabCacheDisplay('party', cachedStatus, showDetail)
  updateTabCacheDisplay('collection', cachedStatus, showDetail)
  updateTabCacheDisplay('database', cachedStatus, showDetail)
}
