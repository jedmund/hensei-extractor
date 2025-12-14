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
 * Safely set values in chrome.storage.local
 * @param {object} data - Key-value pairs to store
 * @returns {Promise<boolean>} True if successful, false on error
 */
export async function safeSet(data) {
  try {
    await chrome.storage.local.set(data)
    return true
  } catch (error) {
    // Check for quota exceeded
    if (error.message?.includes('QUOTA_BYTES')) {
      console.error('Storage quota exceeded:', error)
      // Could implement cache eviction here in the future
    } else {
      console.error('Storage set failed:', error)
    }
    return false
  }
}

/**
 * Safely remove values from chrome.storage.local
 * @param {string|string[]} keys - Key(s) to remove
 * @returns {Promise<boolean>} True if successful, false on error
 */
export async function safeRemove(keys) {
  try {
    await chrome.storage.local.remove(keys)
    return true
  } catch (error) {
    console.error('Storage remove failed:', error)
    return false
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
