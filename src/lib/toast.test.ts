import { describe, expect, it } from 'vitest'
import {
  TOAST_MAX_DURATION_MS,
  TOAST_MIN_DURATION_MS,
  toastDuration
} from './toast.js'

describe('toastDuration', () => {
  it.each(['', 'Copied', 'Raids reloaded', 'コピーしました'])(
    'keeps short message %j at the minimum',
    (message) => {
      expect(toastDuration(message)).toBe(TOAST_MIN_DURATION_MS)
    }
  )

  it('gives a long English message more time', () => {
    const message =
      'Opening party... 3 items had problems and may be missing details'
    const duration = toastDuration(message)
    expect(duration).toBeGreaterThan(TOAST_MIN_DURATION_MS)
    expect(duration).toBeLessThan(TOAST_MAX_DURATION_MS)
  })

  it('weights Japanese text more heavily than Latin text', () => {
    const message =
      'パーティを開いています... 3件のアイテムに問題があり、一部の設定が反映されていない可能性があります'
    const duration = toastDuration(message)
    expect(duration).toBeGreaterThan(TOAST_MIN_DURATION_MS)
    expect(duration).toBeLessThan(TOAST_MAX_DURATION_MS)
    expect(duration).toBeGreaterThan(toastDuration('a'.repeat(message.length)))
  })

  it('caps very long messages', () => {
    expect(toastDuration('a'.repeat(1000))).toBe(TOAST_MAX_DURATION_MS)
  })
})
