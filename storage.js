/**
 * @fileoverview Safe storage wrapper for Chrome extension storage.
 * Provides error handling for storage operations to prevent silent failures.
 */

/**
 * Safely get values from chrome.storage.local
 * @param {string|string[]} keys - Key(s) to retrieve
 * @returns {Promise<object>} Retrieved values, or empty object on error
 */
export async function safeGet(keys) {
  try {
    return await chrome.storage.local.get(keys)
  } catch (error) {
    console.error('Storage get failed:', error)
    return {}
  }
}

/**
 * Get the current storage usage
 * @returns {Promise<{bytesInUse: number, quota: number}|null>}
 */
export async function getStorageUsage() {
  try {
    const bytesInUse = await chrome.storage.local.getBytesInUse()
    // Chrome's local storage quota is typically 10MB (10485760 bytes)
    const quota = 10485760
    return { bytesInUse, quota }
  } catch (error) {
    console.error('Failed to get storage usage:', error)
    return null
  }
}
