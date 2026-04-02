/**
 * Safe storage wrapper for Chrome extension storage.
 * Provides error handling for storage operations to prevent silent failures.
 */

/**
 * Safely get values from chrome.storage.local
 */
export async function safeGet<T = Record<string, unknown>>(
  keys: string | string[]
): Promise<T> {
  try {
    return (await chrome.storage.local.get(keys)) as T
  } catch (error) {
    console.error('Storage get failed:', error)
    return {} as T
  }
}

/**
 * Get the current storage usage
 */
export async function getStorageUsage(): Promise<{
  bytesInUse: number
  quota: number
} | null> {
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
