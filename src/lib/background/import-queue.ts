/**
 * The import queue: every journal detail page (character, weapon, summon) an
 * editor opens in game, waiting to be imported into the database.
 *
 * Entries live in IndexedDB rather than chrome.storage.local: a few hundred
 * character payloads (15–40 KB each) would fill chrome.storage's 10 MB quota,
 * and IndexedDB needs no extra permission.
 *
 * Each entry is keyed by type, granblue ID, style and language, so English
 * and Japanese captures and a character's style shift are separate entries.
 * A newer capture of the same key replaces the older one. Entries stay until
 * they're imported or cleared.
 *
 * Metadata and payloads sit in two object stores under the same key, so the
 * list and the counts never read a payload. The request URL is never stored:
 * it carries the player's uid.
 */

import type { PayloadLanguage } from '../detail-language.js'

export type QueueItemType = 'npc' | 'weapon' | 'summon'
export type QueueStatus = 'queued' | 'importing' | 'failed'
export type QueueStyle = 1 | 2

export interface QueueEntry {
  key: string
  type: QueueItemType
  granblueId: string
  name: string
  lang: PayloadLanguage
  style: QueueStyle
  capturedAt: number
  status: QueueStatus
  /** The error code from the last failed import */
  error?: string
}

/** What a capture says about itself; the queue adds the status. */
export type QueueCapture = Omit<QueueEntry, 'status' | 'error'>

export interface QueueCounts {
  total: number
  failed: number
  byType: Record<QueueItemType, Record<PayloadLanguage, number>>
}

const DB_NAME = 'hensei-import-queue'
const DB_VERSION = 1
const ENTRIES = 'entries'
const PAYLOADS = 'payloads'

const QUEUE_TYPES: Record<string, QueueItemType> = {
  detail_npc: 'npc',
  detail_weapon: 'weapon',
  detail_summon: 'summon'
}

const DATA_TYPE_PATTERN = /^detail_((?:npc|weapon|summon)_.+_[12]_(?:en|jp))$/

// ==========================================
// KEYS
// ==========================================

export function queueKey(
  capture: Pick<QueueCapture, 'type' | 'granblueId' | 'style' | 'lang'>
): string {
  const { type, granblueId, style, lang } = capture
  return `${type}_${granblueId}_${style}_${lang}`
}

/** The side panel's data type for a queue entry, e.g. detail_npc_3040001000_1_en */
export function queueDataType(key: string): string {
  return `detail_${key}`
}

/** The queue key a detail data type points at, or null for anything else */
export function queueKeyFromDataType(dataType: string): string | null {
  return DATA_TYPE_PATTERN.exec(dataType)?.[1] ?? null
}

/** A character's style: 2 for a style shift, 1 otherwise. */
export function styleOf(data: Record<string, unknown>): QueueStyle {
  const param = data.param as Record<string, unknown> | undefined
  const style = data.style ?? param?.style
  return String(style) === '2' ? 2 : 1
}

/**
 * The queue metadata for a captured detail page, or null when it isn't a
 * journal detail page or has no ID.
 */
export function describeCapture(
  dataType: string,
  data: Record<string, unknown>,
  lang: PayloadLanguage,
  capturedAt: number
): QueueCapture | null {
  const type = QUEUE_TYPES[dataType]
  if (!type) return null

  const master = data.master as Record<string, unknown> | undefined
  const id = data.id ?? master?.id
  if ((typeof id !== 'string' && typeof id !== 'number') || id === '') {
    return null
  }
  const granblueId = String(id)
  const name = data.name ?? master?.name
  const style = type === 'npc' ? styleOf(data) : 1

  const capture = {
    type,
    granblueId,
    name: typeof name === 'string' && name ? name : granblueId,
    lang,
    style,
    capturedAt
  }
  return { key: queueKey(capture), ...capture }
}

export function countEntries(entries: QueueEntry[]): QueueCounts {
  const counts: QueueCounts = {
    total: entries.length,
    failed: 0,
    byType: {
      npc: { en: 0, jp: 0 },
      weapon: { en: 0, jp: 0 },
      summon: { en: 0, jp: 0 }
    }
  }
  for (const entry of entries) {
    counts.byType[entry.type][entry.lang] += 1
    if (entry.status === 'failed') counts.failed += 1
  }
  return counts
}

// ==========================================
// INDEXEDDB
// ==========================================

let connection: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ENTRIES)) {
        db.createObjectStore(ENTRIES, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(PAYLOADS)) {
        db.createObjectStore(PAYLOADS, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      // Another context upgrading the database closes this connection
      db.onversionchange = () => {
        db.close()
        connection = null
      }
      resolve(db)
    }
    request.onerror = () => {
      connection = null
      reject(request.error)
    }
  })
  return connection
}

/** Closes the connection; the next call reopens it. For tests. */
export async function closeQueueDb(): Promise<void> {
  const db = await connection?.catch(() => null)
  db?.close()
  connection = null
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}

/** Runs `fn` in one transaction over `stores` and resolves once it commits */
async function withStores<T>(
  stores: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T>
): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(stores, mode)
  const done = transactionDone(tx)
  const result = await fn(tx)
  await done
  return result
}

// ==========================================
// QUEUE OPERATIONS
// ==========================================

/**
 * Adds a capture to the queue, or replaces the entry with the same key.
 * The entry is queued again and its last error dropped.
 */
export async function putCapture(
  capture: QueueCapture,
  payload: Record<string, unknown>
): Promise<QueueEntry> {
  const entry: QueueEntry = { ...capture, status: 'queued' }
  await withStores([ENTRIES, PAYLOADS], 'readwrite', async (tx) => {
    tx.objectStore(ENTRIES).put(entry)
    tx.objectStore(PAYLOADS).put({ key: entry.key, payload })
  })
  return entry
}

/** Every entry's metadata, newest capture first. Payloads aren't read. */
export async function listEntries(): Promise<QueueEntry[]> {
  const entries = await withStores([ENTRIES], 'readonly', (tx) =>
    requestResult(tx.objectStore(ENTRIES).getAll() as IDBRequest<QueueEntry[]>)
  )
  return entries.sort((a, b) => b.capturedAt - a.capturedAt)
}

export async function getEntry(key: string): Promise<QueueEntry | null> {
  const entry = await withStores([ENTRIES], 'readonly', (tx) =>
    requestResult(
      tx.objectStore(ENTRIES).get(key) as IDBRequest<QueueEntry | undefined>
    )
  )
  return entry ?? null
}

export async function getPayload(
  key: string
): Promise<Record<string, unknown> | null> {
  const row = await withStores([PAYLOADS], 'readonly', (tx) =>
    requestResult(
      tx.objectStore(PAYLOADS).get(key) as IDBRequest<
        { payload: Record<string, unknown> } | undefined
      >
    )
  )
  return row?.payload ?? null
}

/**
 * Sets an entry's status, if it still holds the capture from `capturedAt`.
 * A failed status keeps its error; any other status drops it.
 */
export async function setStatus(
  key: string,
  capturedAt: number,
  status: QueueStatus,
  error?: string
): Promise<boolean> {
  return withStores([ENTRIES], 'readwrite', async (tx) => {
    const store = tx.objectStore(ENTRIES)
    const entry = (await requestResult(store.get(key))) as
      | QueueEntry
      | undefined
    if (!entry || entry.capturedAt !== capturedAt) return false
    const next: QueueEntry = { ...entry, status }
    if (status === 'failed' && error) next.error = error
    else delete next.error
    store.put(next)
    return true
  })
}

/**
 * Removes an entry once it's imported, unless a newer capture replaced it
 * meanwhile: that one hasn't been imported yet.
 */
export async function removeImported(
  key: string,
  capturedAt: number
): Promise<boolean> {
  return withStores([ENTRIES, PAYLOADS], 'readwrite', async (tx) => {
    const entries = tx.objectStore(ENTRIES)
    const entry = (await requestResult(entries.get(key))) as
      | QueueEntry
      | undefined
    if (!entry || entry.capturedAt !== capturedAt) return false
    entries.delete(key)
    tx.objectStore(PAYLOADS).delete(key)
    return true
  })
}

export async function clearQueue(): Promise<void> {
  await withStores([ENTRIES, PAYLOADS], 'readwrite', async (tx) => {
    tx.objectStore(ENTRIES).clear()
    tx.objectStore(PAYLOADS).clear()
  })
}
