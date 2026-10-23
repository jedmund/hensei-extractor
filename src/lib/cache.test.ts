import { describe, expect, it } from 'vitest'
import { formatCacheStatus, npcDetailDisplayName } from './cache.js'
import type { CacheStatusInfo } from './types/cache.js'

const base: CacheStatusInfo = {
  available: true,
  isStale: false,
  age: 1000,
  itemName: 'Cidala'
}

describe('formatCacheStatus for database characters', () => {
  it('names style 1 and style-less captures by the character', () => {
    const formatted = formatCacheStatus({
      detail_npc_3040377000: base,
      detail_npc_3040001000: { ...base, itemName: 'Katalina' }
    })

    expect(formatted.detail_npc_3040377000!.displayName).toBe('Cidala')
    expect(formatted.detail_npc_3040001000!.displayName).toBe('Katalina')
  })

  it('names a later style by its style name', () => {
    const formatted = formatCacheStatus({
      detail_npc_3040377000_style2: {
        ...base,
        style: 2,
        styleName: 'Super Cidala'
      }
    })

    expect(formatted.detail_npc_3040377000_style2!.displayName).toBe(
      'Super Cidala'
    )
    expect(formatted.detail_npc_3040377000_style2!.style).toBe(2)
  })

  it('marks a later style without a name as a style shift', () => {
    expect(npcDetailDisplayName('Cidala', 2, undefined)).toBe(
      'Cidala (Style Shift)'
    )
    expect(npcDetailDisplayName('Cidala', 1, 'Default Style')).toBe('Cidala')
    expect(npcDetailDisplayName('Cidala', undefined, undefined)).toBe('Cidala')
  })
})
