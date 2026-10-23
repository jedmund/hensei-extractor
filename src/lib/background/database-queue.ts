/**
 * The background worker's side of the Database tab: collecting journal
 * detail pages into the import queue, importing entries through the
 * existing per-item endpoints, and reporting the queue to the side panel.
 */

import { payloadLanguage, uploadDetailData } from './collections.js'
import {
  clearQueue,
  countEntries,
  describeCapture,
  getEntry,
  getPayload,
  listEntries,
  putCapture,
  removeImported,
  setStatus,
  type QueueCounts,
  type QueueEntry
} from './import-queue.js'
import {
  runQueueImport,
  STOP_ERRORS,
  type ImportProgress,
  type ImportSummary
} from './import-runner.js'

/** The role that can import game data (and sees the Database tab) */
const EDITOR_ROLE = 7

export interface ImportQueueState {
  entries: QueueEntry[]
  counts: QueueCounts
  /** The Import all run in progress, if there is one */
  progress: ImportProgress | null
}

export interface DatabaseQueueDependencies {
  upload: typeof uploadDetailData
  notify: (message: Record<string, unknown>) => Promise<unknown>
}

const defaultDependencies: DatabaseQueueDependencies = {
  upload: uploadDetailData,
  notify: (message) => chrome.runtime.sendMessage(message)
}

let progress: ImportProgress | null = null

async function isEditor(): Promise<boolean> {
  const { gbAuth } = await chrome.storage.local.get('gbAuth')
  const role = (gbAuth as { role?: number } | undefined)?.role ?? 0
  return role >= EDITOR_ROLE
}

/**
 * Adds a journal detail page to the queue for an editor. Returns the queue
 * key, or null when nothing was queued.
 */
export async function queueDetailCapture(
  dataType: string,
  data: Record<string, unknown>,
  capturedAt: number
): Promise<string | null> {
  if (!(await isEditor())) return null
  const capture = describeCapture(
    dataType,
    data,
    await payloadLanguage(data),
    capturedAt
  )
  if (!capture) return null
  await putCapture(capture, data)
  return capture.key
}

/**
 * Imports one queued entry. It's removed when the import succeeds and
 * marked failed with the error when it doesn't. A login error puts it back
 * as queued: the entry itself is fine.
 */
export async function importQueuedItem(
  key: string,
  dependencies: Pick<DatabaseQueueDependencies, 'upload'> = defaultDependencies
): Promise<{ success?: boolean; error?: string }> {
  const entry = await getEntry(key)
  const payload = entry && (await getPayload(key))
  if (!entry || !payload) return { error: 'no_cached_data' }

  await setStatus(key, entry.capturedAt, 'importing')
  let result: { success?: boolean; error?: string }
  try {
    result = await dependencies.upload(
      payload,
      `detail_${entry.type}`,
      entry.lang
    )
  } catch {
    result = { error: 'request_failed' }
  }

  if (!result.error) {
    await removeImported(key, entry.capturedAt)
  } else if (STOP_ERRORS.has(result.error)) {
    await setStatus(key, entry.capturedAt, 'queued')
  } else {
    await setStatus(key, entry.capturedAt, 'failed', result.error)
  }
  return result
}

/**
 * The queue's metadata and counts, without payloads. An entry left
 * "importing" by a worker that stopped mid-run counts as queued.
 */
export async function getImportQueue(): Promise<ImportQueueState> {
  const entries = (await listEntries()).map((entry) =>
    entry.status === 'importing' && !progress
      ? { ...entry, status: 'queued' as const }
      : entry
  )
  return { entries, counts: countEntries(entries), progress }
}

/**
 * Imports every entry in the queue, queued or failed, one at a time, and
 * broadcasts progress to the side panel. Only one run happens at a time.
 */
export async function importQueueAll(
  dependencies: DatabaseQueueDependencies = defaultDependencies
): Promise<ImportSummary | { error: string }> {
  if (progress) return { error: 'already_running' }
  progress = { done: 0, total: 0, imported: 0, failed: 0 }

  try {
    const keys = (await listEntries()).map((entry) => entry.key)
    return await runQueueImport(
      keys,
      (key) => importQueuedItem(key, dependencies),
      (next) => {
        progress = next
        dependencies
          .notify({ action: 'importQueueProgress', progress: next })
          .catch(() => {})
      }
    )
  } finally {
    progress = null
    // Tells a side panel opened mid-run that the run is over
    dependencies
      .notify({ action: 'importQueueProgress', progress: null })
      .catch(() => {})
  }
}

export async function clearImportQueue(): Promise<{ success: boolean }> {
  await clearQueue()
  return { success: true }
}

const LEGACY_DETAIL_PREFIX = 'gbf_cache_detail_'
const LEGACY_CLEARED_FLAG = 'legacyDetailCacheCleared'

/**
 * Removes the detail captures stored before the queue, once. They were
 * 30-minute captures without a language or style, so they're not moved over;
 * opening the page again queues it.
 */
export async function removeLegacyDetailCache(): Promise<void> {
  const local = chrome.storage.local
  const flag = await local.get(LEGACY_CLEARED_FLAG)
  if (flag[LEGACY_CLEARED_FLAG]) return

  const keys =
    typeof local.getKeys === 'function'
      ? await local.getKeys()
      : Object.keys(await local.get(null))
  const legacy = keys.filter((key) => key.startsWith(LEGACY_DETAIL_PREFIX))
  if (legacy.length > 0) await local.remove(legacy)
  await local.set({ [LEGACY_CLEARED_FLAG]: true })
}
