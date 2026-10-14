/**
 * Marks a cached capture as imported once it's been uploaded, so the side
 * panel can show it on the row. Nothing is removed.
 *
 * The mark records which capture was imported (its timestamp). A newer
 * capture of the same entry changes the data, so the mark only counts while
 * the entry still holds that capture; the writers that merge into an
 * existing entry also drop it.
 */

import { resolveCacheKey } from '../constants.js'

export interface ImportMark {
  /** When the capture was imported */
  importedAt?: number
  /** The capture time (timestamp or lastUpdated) of the imported data */
  importedCapture?: number
}

/** When the entry was captured: `timestamp`, or `lastUpdated` for pages. */
export function captureTime(entry: unknown): number | null {
  if (!entry || typeof entry !== 'object') return null
  const { timestamp, lastUpdated } = entry as Record<string, unknown>
  if (typeof timestamp === 'number') return timestamp
  if (typeof lastUpdated === 'number') return lastUpdated
  return null
}

/** When the entry's current capture was imported, if it has been. */
export function importedAtOf(entry: unknown): number | undefined {
  if (!entry || typeof entry !== 'object') return undefined
  const { importedAt, importedCapture } = entry as ImportMark
  if (typeof importedAt !== 'number') return undefined
  return importedCapture === captureTime(entry) ? importedAt : undefined
}

async function readEntry(
  dataType: string
): Promise<{ key: string; entry: Record<string, unknown> } | null> {
  const key = resolveCacheKey(dataType)
  if (!key) return null
  const entry = (await chrome.storage.local.get(key))[key]
  if (!entry || typeof entry !== 'object') return null
  return { key, entry: entry as Record<string, unknown> }
}

/** The capture time of the entry cached for `dataType`, if there is one. */
export async function readCaptureTime(
  dataType: string
): Promise<number | null> {
  return captureTime((await readEntry(dataType))?.entry)
}

/**
 * Marks the entry for `dataType` as imported, if it still holds the capture
 * from `capturedAt`. An entry captured again or cleared meanwhile is left
 * alone.
 */
export async function markImported(
  dataType: string,
  capturedAt: number,
  now = Date.now()
): Promise<boolean> {
  const found = await readEntry(dataType)
  if (!found || captureTime(found.entry) !== capturedAt) return false
  const mark: ImportMark = { importedAt: now, importedCapture: capturedAt }
  await chrome.storage.local.set({ [found.key]: { ...found.entry, ...mark } })
  return true
}

/** Drops the import mark from an entry that's about to be written again. */
export function clearImportMark(entry: ImportMark): void {
  delete entry.importedAt
  delete entry.importedCapture
}

function succeeded(result: unknown): boolean {
  return (
    !!result &&
    typeof result === 'object' &&
    (result as { success?: unknown }).success === true
  )
}

/**
 * Runs an upload of the capture cached for `dataType`, and marks the
 * capture imported if it succeeds. Marking never fails the upload.
 */
export async function withImportMark<R>(
  dataType: string,
  upload: () => Promise<R>
): Promise<R> {
  const capturedAt = await readCaptureTime(dataType)
  const result = await upload()
  if (capturedAt !== null && succeeded(result)) {
    try {
      await markImported(dataType, capturedAt)
    } catch (error) {
      console.error('Failed to mark the capture as imported:', error)
    }
  }
  return result
}
