import { describe, expect, it } from 'vitest'
import { npcDetailDisplayName } from './cache.js'

describe('npcDetailDisplayName', () => {
  it('names style 1 and style-less captures by the character', () => {
    expect(npcDetailDisplayName('Cidala', 1, 'Default Style')).toBe('Cidala')
    expect(npcDetailDisplayName('Cidala', undefined, undefined)).toBe('Cidala')
  })

  it('names a later style by its style name', () => {
    expect(npcDetailDisplayName('Cidala', 2, 'Super Cidala')).toBe(
      'Super Cidala'
    )
  })

  it('marks a later style without a name as a style shift', () => {
    expect(npcDetailDisplayName('Cidala', 2, undefined)).toBe(
      'Cidala (Style Shift)'
    )
  })
})
