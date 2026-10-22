/**
 * Imports the queue one entry at a time. Kept free of storage and network so
 * it can be tested on its own; the worker passes in the per-entry import.
 */

/** Errors that mean the login can't import: stop instead of failing every entry. */
export const STOP_ERRORS: ReadonlySet<string> = new Set([
  'not_logged_in',
  'invalid_token',
  'forbidden'
])

export interface ImportProgress {
  done: number
  total: number
  imported: number
  failed: number
}

export interface ImportSummary extends ImportProgress {
  /** The login error that stopped the run, if one did */
  stoppedBy: string | null
}

export type ImportOne = (key: string) => Promise<{ error?: string }>

export async function runQueueImport(
  keys: string[],
  importOne: ImportOne,
  onProgress: (progress: ImportProgress) => void = () => {}
): Promise<ImportSummary> {
  const progress: ImportProgress = {
    done: 0,
    total: keys.length,
    imported: 0,
    failed: 0
  }
  onProgress({ ...progress })

  for (const key of keys) {
    let error: string | undefined
    try {
      error = (await importOne(key)).error
    } catch {
      error = 'internal_error'
    }

    if (error && STOP_ERRORS.has(error)) {
      return { ...progress, stoppedBy: error }
    }

    progress.done += 1
    if (error) progress.failed += 1
    else progress.imported += 1
    onProgress({ ...progress })
  }

  return { ...progress, stoppedBy: null }
}
