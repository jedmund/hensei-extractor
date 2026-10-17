import { describe, expect, it } from 'vitest'
import { resolveTheme } from './theme.js'

describe('resolveTheme', () => {
  it("uses the account's light or dark setting whatever the browser says", () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it("follows the browser when the account's setting is system", () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('follows the browser when logged out or the setting is unknown', () => {
    expect(resolveTheme(undefined, true)).toBe('dark')
    expect(resolveTheme('sepia', false)).toBe('light')
  })
})
