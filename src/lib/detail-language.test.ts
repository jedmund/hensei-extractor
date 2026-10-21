import { describe, expect, it } from 'vitest'
import npcDetailJp from './__fixtures__/npc-detail-jp.json'
import { detectPayloadLanguage } from './detail-language.js'

describe('detectPayloadLanguage', () => {
  it('reads a Japanese npc_detail payload as jp', () => {
    expect(detectPayloadLanguage(npcDetailJp)).toBe('jp')
  })

  it('reads an English npc_detail payload as en', () => {
    expect(
      detectPayloadLanguage({
        master: { id: '3040377000', name: 'Cidala' },
        special_skill: { name: 'Tiger Soul' },
        ability: { 1: { name: 'Luck Goes Up', name_en: 'Luck Goes Up' } },
        support_ability: { 1: { name: 'Tiger Unity' } }
      })
    ).toBe('en')
  })

  it('judges by the game text, not the _en copies', () => {
    expect(
      detectPayloadLanguage({
        ability: { 1: { name: '運気揚々', name_en: 'Luck Goes Up' } }
      })
    ).toBe('jp')
  })

  it('reads weapon and summon skill names', () => {
    expect(
      detectPayloadLanguage({
        master: { id: '1' },
        skill1: { name: '紅蓮の攻刃' }
      })
    ).toBe('jp')
    expect(
      detectPayloadLanguage({
        master: { id: '2' },
        skill: { name: 'Fire Rite' }
      })
    ).toBe('en')
  })

  it('returns null when there is nothing to judge', () => {
    expect(detectPayloadLanguage({})).toBeNull()
    expect(detectPayloadLanguage(null)).toBeNull()
    expect(detectPayloadLanguage({ master: { id: '3040377000' } })).toBeNull()
  })
})
