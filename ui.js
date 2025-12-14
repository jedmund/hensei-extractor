/**
 * @fileoverview UI helper functions for the Granblue Fantasy Chrome extension.
 * Contains reusable UI utilities.
 */

import { show, hide } from './dom.js'

/**
 * Shows a status message in an element
 * @param {string} containerId - ID of the container element
 * @param {string} messageId - ID of the message element
 * @param {string} message - The message to display
 * @param {string} type - Message type (info, success, error)
 * @param {string} baseClass - Base CSS class for the container
 */
export function showStatusMessage(containerId, messageId, message, type = "info", baseClass = "") {
  const container = document.getElementById(containerId)
  const messageEl = document.getElementById(messageId)
  if (!container) return

  show(container)
  container.className = baseClass ? `${baseClass} status-${type}` : `status-${type}`
  if (messageEl) messageEl.textContent = message
}

/**
 * Hides a status message
 * @param {string} containerId - ID of the container element
 * @param {string} messageId - ID of the message element
 * @param {string} baseClass - Base CSS class to restore
 */
export function hideStatusMessage(containerId, messageId, baseClass = "") {
  const container = document.getElementById(containerId)
  const messageEl = document.getElementById(messageId)
  if (!container) return

  hide(container)
  container.className = baseClass
  if (messageEl) messageEl.textContent = ""
}
