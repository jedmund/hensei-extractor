/**
 * Discriminated union for messages between popup and background
 * via chrome.runtime.sendMessage.
 */

export type ExtensionMessage =
  | { action: 'getCacheStatus' }
  | { action: 'getCachedData'; dataType: string }
  | { action: 'clearCache' }
  | { action: 'importItems'; data: unknown; dataType: string }
  | { action: 'previewSyncDeletions'; data: unknown; dataType: string }
  | { action: 'confirmSync'; data: unknown; dataType: string; deletions: unknown }
  | { action: 'popOutWindow' }
  | { action: 'fetchRaidGroups' }

export interface ExtensionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}
