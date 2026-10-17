import { describe, expect, it } from 'vitest'
import { importVisibility } from './visibility.js'

describe('importVisibility', () => {
  it("uses the account's default when the user hasn't picked one", () => {
    expect(importVisibility(null, 1)).toBe(1)
    expect(importVisibility(null, 2)).toBe(2)
  })

  it('lets the pick for this import override the account default', () => {
    expect(importVisibility(3, 1)).toBe(3)
    expect(importVisibility(1, 3)).toBe(1)
  })

  it('falls back to private before the account settings have loaded', () => {
    expect(importVisibility(null, undefined)).toBe(3)
  })
})
