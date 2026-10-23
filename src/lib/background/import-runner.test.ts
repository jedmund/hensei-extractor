import { describe, expect, it, vi } from 'vitest'
import { runQueueImport, type ImportProgress } from './import-runner.js'

describe('runQueueImport', () => {
  it('imports every entry in order and reports progress', async () => {
    const importOne = vi.fn(async (_key: string) => ({}))
    const seen: ImportProgress[] = []

    const summary = await runQueueImport(['a', 'b'], importOne, (p) =>
      seen.push(p)
    )

    expect(importOne.mock.calls.map(([key]) => key)).toEqual(['a', 'b'])
    expect(seen).toEqual([
      { done: 0, total: 2, imported: 0, failed: 0 },
      { done: 1, total: 2, imported: 1, failed: 0 },
      { done: 2, total: 2, imported: 2, failed: 0 }
    ])
    expect(summary).toEqual({
      done: 2,
      total: 2,
      imported: 2,
      failed: 0,
      stoppedBy: null
    })
  })

  it('counts a failure and carries on', async () => {
    const importOne = vi.fn(async (key: string) =>
      key === 'b' ? { error: 'not_found' } : {}
    )

    const summary = await runQueueImport(['a', 'b', 'c'], importOne)

    expect(importOne).toHaveBeenCalledTimes(3)
    expect(summary).toMatchObject({ done: 3, imported: 2, failed: 1 })
    expect(summary.stoppedBy).toBeNull()
  })

  it('treats a thrown import as a failure', async () => {
    const summary = await runQueueImport(['a'], async () => {
      throw new Error('boom')
    })

    expect(summary).toMatchObject({ done: 1, imported: 0, failed: 1 })
  })

  it.each(['invalid_token', 'not_logged_in', 'forbidden'])(
    'stops at the first %s instead of trying the rest',
    async (error) => {
      const importOne = vi.fn(async (key: string) =>
        key === 'b' ? { error } : {}
      )

      const summary = await runQueueImport(['a', 'b', 'c'], importOne)

      expect(importOne).toHaveBeenCalledTimes(2)
      expect(summary).toEqual({
        done: 1,
        total: 3,
        imported: 1,
        failed: 0,
        stoppedBy: error
      })
    }
  )
})
