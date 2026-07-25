import { describe, expect, it } from 'vitest'
import { compareVersions } from './reference-data.js'

describe('compareVersions', () => {
  it.each([
    ['1.2.3', '1.2.3', 0],
    ['1.2', '1.2.0', 0],
    ['1.2.4', '1.2.3', 1],
    ['1.10.0', '1.9.9', 1],
    ['2.0.0', '10.0.0', -1]
  ])('compares %s with %s', (left, right, expected) => {
    expect(compareVersions(left, right)).toBe(expected)
  })
})
