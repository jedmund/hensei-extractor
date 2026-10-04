import { describe, expect, it, vi } from 'vitest'

// The app state uses Svelte runes, which only compile inside components.
vi.mock('./state/app.svelte.js', () => ({ app: { locale: 'en' } }))

import { getImageUrl } from './constants.js'
import {
  firstAugmentShowValue,
  getWeaponModifiers,
  type RawGameItem
} from './detail-helpers.js'
import {
  artifactLabelIcons,
  characterStatRows,
  commentLines,
  itemCommentLines,
  starClasses,
  summonStatRows,
  weaponStatRows,
  type StatRowData
} from './item-stats.js'

/** Rows as label → displayed value, for readable assertions */
function flatten(rows: StatRowData[]): Array<[string, unknown]> {
  return rows.map(({ label, value }) => {
    if (value.kind === 'text') return [label, value.text]
    if (value.kind === 'icons') return [label, value.icons]
    return [label, value.stars]
  })
}

const elementIcon = (name: string) => ({
  src: getImageUrl(`labels/element/Label_Element_${name}.png`),
  alt: name
})
const proficiencyIcon = (name: string) => ({
  src: getImageUrl(`labels/proficiency/Label_Weapon_${name}.png`),
  alt: name
})

describe('starClasses', () => {
  it('gives characters four base stars, then FLB at 100 and ULB at 150', () => {
    expect(starClasses(80, 'character')).toEqual([
      'filled',
      'filled',
      'filled',
      'filled'
    ])
    expect(starClasses(100, 'character')).toEqual([
      'filled',
      'filled',
      'filled',
      'filled',
      'flb'
    ])
    expect(starClasses(150, 'character')).toEqual([
      'filled',
      'filled',
      'filled',
      'filled',
      'flb',
      'ulb'
    ])
  })

  it('gives weapons and summons three base stars and two FLB tiers', () => {
    for (const type of ['weapon', 'summon']) {
      expect(starClasses(100, type)).toEqual(['filled', 'filled', 'filled'])
      expect(starClasses(150, type)).toEqual([
        'filled',
        'filled',
        'filled',
        'flb'
      ])
      expect(starClasses(200, type)).toEqual([
        'filled',
        'filled',
        'filled',
        'flb',
        'flb'
      ])
      expect(starClasses(250, type)).toEqual([
        'filled',
        'filled',
        'filled',
        'flb',
        'flb',
        'ulb'
      ])
    }
  })

  it('is null for an unknown type', () => {
    expect(starClasses(100, 'artifact')).toBeNull()
  })
})

describe('artifactLabelIcons', () => {
  it('lists the element then the proficiency label', () => {
    expect(artifactLabelIcons({ attribute: 2, kind: 3 })).toEqual([
      getImageUrl('labels/element/Label_Element_Water.png'),
      getImageUrl('labels/proficiency/Label_Weapon_Spear.png')
    ])
  })

  it('falls back to element and weapon_kind', () => {
    expect(artifactLabelIcons({ element: '1', weapon_kind: '4' })).toEqual([
      getImageUrl('labels/element/Label_Element_Fire.png'),
      getImageUrl('labels/proficiency/Label_Weapon_Axe.png')
    ])
  })

  it('skips unknown or missing values', () => {
    expect(artifactLabelIcons({ attribute: 99, kind: 99 })).toEqual([])
    expect(artifactLabelIcons({})).toEqual([])
  })
})

describe('commentLines', () => {
  it('is empty without a comment', () => {
    expect(commentLines(undefined)).toEqual([])
    expect(commentLines('')).toEqual([])
  })

  it('keeps plain flavour text as one line', () => {
    expect(commentLines('Water personified—the dragon.')).toEqual([
      'Water personified—the dragon.'
    ])
  })

  it('splits on each form of <br>', () => {
    expect(commentLines('One<br>Two<br/>Three<BR />Four')).toEqual([
      'One',
      'Two',
      'Three',
      'Four'
    ])
  })

  it('drops the span wrappers the game uses, quoted or not', () => {
    expect(
      commentLines('Boost <span class="text-blue">(Can\'t recast)</span>')
    ).toEqual(["Boost (Can't recast)"])
    expect(commentLines('Boost <span class=text-blue>(Max: 4)</span>')).toEqual(
      ['Boost (Max: 4)']
    )
  })

  it('leaves any other markup as literal text', () => {
    expect(commentLines('<img src=x onerror=alert(1)>')).toEqual([
      '<img src=x onerror=alert(1)>'
    ])
    expect(
      commentLines(
        'Hi<br><script>alert(1)</script><span onclick=x>there</span>'
      )
    ).toEqual(['Hi', '<script>alert(1)</script>there'])
  })

  it('decodes entities once, so encoded markup stays text', () => {
    expect(commentLines('Fire &amp; Water &lt;b&gt;')).toEqual([
      'Fire & Water <b>'
    ])
  })

  it('reads the item comment, then the master comment', () => {
    expect(
      itemCommentLines({ comment: 'Top', master: { comment: 'M' } })
    ).toEqual(['Top'])
    expect(itemCommentLines({ master: { comment: 'M' } })).toEqual(['M'])
    expect(itemCommentLines({})).toEqual([])
  })
})

describe('characterStatRows', () => {
  it('lists the base stats in order, then the perpetuity ring', () => {
    const item: RawGameItem = {
      master: {
        series_id: 1,
        default_hp: 300,
        max_hp: 1500,
        default_attack: 1200,
        max_attack: 8000,
        max_level: 100
      },
      param: { has_npcaugment_constant: true }
    }
    expect(flatten(characterStatRows(item, '3040001000', 2, [1, 3]))).toEqual([
      ['ID', '3040001000'],
      ['Series', 'Summer'],
      ['Element', [elementIcon('Water')]],
      ['Proficiency', [proficiencyIcon('Sabre'), proficiencyIcon('Spear')]],
      ['Uncap', ['filled', 'filled', 'filled', 'filled', 'flb']],
      ['Min HP', (300).toLocaleString()],
      ['Max HP', (1500).toLocaleString()],
      ['Min ATK', (1200).toLocaleString()],
      ['Max ATK', (8000).toLocaleString()],
      ['Max Level', '100'],
      ['Perpetuity Ring', '✓']
    ])
  })

  it('prefers captured param stats and leaves out missing ones', () => {
    const item: RawGameItem = {
      master: { max_hp: 1000, max_attack: 5000, max_level: 80 },
      param: { hp: 1234, attack: 6789, level: 90 }
    }
    expect(flatten(characterStatRows(item, '', undefined, [99]))).toEqual([
      ['Uncap', ['filled', 'filled', 'filled', 'filled']],
      ['Max HP', (1234).toLocaleString()],
      ['Max ATK', (6789).toLocaleString()],
      ['Max Level', '90']
    ])
  })

  it('keeps game text as plain strings', () => {
    const rows = characterStatRows(
      { master: { max_level: 80 } },
      '<img src=x onerror=alert(1)>',
      undefined
    )
    expect(rows[0]).toEqual({
      label: 'ID',
      value: { kind: 'text', text: '<img src=x onerror=alert(1)>' }
    })
  })
})

describe('weaponStatRows', () => {
  const base = { master: { series_id: 2, max_level: 150 } }

  it('shows the awakening, falling back to Attack Lv.1', () => {
    const rows = weaponStatRows(
      { ...base, param: { arousal: { is_arousal_weapon: true } } },
      '1040001',
      3,
      4
    )
    expect(flatten(rows)).toEqual([
      ['ID', '1040001'],
      ['Series', 'Grand'],
      ['Element', [elementIcon('Earth')]],
      ['Proficiency', [proficiencyIcon('Axe')]],
      ['Uncap', ['filled', 'filled', 'filled', 'flb']],
      ['Max Level', '150'],
      ['Awakening', 'Attack Lv.1']
    ])
  })

  it('shows the awakening form and level', () => {
    const rows = weaponStatRows(
      {
        param: {
          arousal: { is_arousal_weapon: true, form_name: 'Defense', level: 7 }
        }
      },
      '',
      undefined
    )
    expect(flatten(rows)).toEqual([['Awakening', 'Defense Lv.7']])
  })

  it('counts AX skills', () => {
    const one = weaponStatRows(
      { param: { augment_skill_info: [{ a: { show_value: '+3%' } }] } },
      '',
      undefined
    )
    expect(flatten(one)).toEqual([['AX Skills', '1 skill']])

    const two = weaponStatRows(
      { param: { augment_skill_info: [{ a: {}, b: {} }] } },
      '',
      undefined
    )
    expect(flatten(two)).toEqual([['AX Skills', '2 skills']])

    const none = weaponStatRows(
      { param: { augment_skill_info: [{}] } },
      '',
      undefined
    )
    expect(none).toEqual([])
  })

  it('shows befoulment and exorcism instead of AX skills', () => {
    const rows = weaponStatRows(
      {
        param: {
          odiant: {
            is_odiant_weapon: true,
            exorcision_level: 2,
            max_exorcision_level: 4
          },
          augment_skill_info: [{ a: { show_value: 'DEF -10%' } }]
        }
      },
      '',
      undefined
    )
    expect(flatten(rows)).toEqual([
      ['Befoulment', 'DEF -10%'],
      ['Exorcism', '2/4']
    ])
  })

  it('falls back to Active and 0/5 for befoulment', () => {
    const rows = weaponStatRows(
      { param: { odiant: { is_odiant_weapon: true } } },
      '',
      undefined
    )
    expect(flatten(rows)).toEqual([
      ['Befoulment', 'Active'],
      ['Exorcism', '0/5']
    ])
  })
})

describe('summonStatRows', () => {
  it('lists the base stats, then the sub aura', () => {
    const item: RawGameItem = {
      master: { series_id: 3, max_level: 250, default_attack: 100 },
      sub_skill: { name: 'Sub <b>Aura</b>' }
    }
    expect(flatten(summonStatRows(item, '2040001000', 6))).toEqual([
      ['ID', '2040001000'],
      ['Series', 'Magna'],
      ['Element', [elementIcon('Dark')]],
      ['Uncap', ['filled', 'filled', 'filled', 'flb', 'flb', 'ulb']],
      ['Min ATK', (100).toLocaleString()],
      ['Max Level', '250'],
      ['Sub Aura', 'Sub <b>Aura</b>']
    ])
  })

  it('has no proficiency row', () => {
    const rows = summonStatRows({ specialty_weapon: [1] }, '', undefined)
    expect(rows).toEqual([])
  })
})

describe('befoulment value', () => {
  // The game sends each augment_skill_info entry as a list of skills
  const befouled = {
    param: {
      odiant: {
        is_odiant_weapon: true,
        exorcision_level: 2,
        max_exorcision_level: 5
      },
      augment_skill_info: [[{ skill_id: 1801, show_value: '-10%' }]]
    }
  } as unknown as RawGameItem

  it('reads the first skill of a list or a keyed entry', () => {
    expect(firstAugmentShowValue([{ show_value: '-10%' }])).toBe('-10%')
    expect(firstAugmentShowValue({ 1801: { show_value: '-10%' } })).toBe('-10%')
    expect(firstAugmentShowValue([])).toBeNull()
    expect(firstAugmentShowValue(undefined)).toBeNull()
  })

  it('gives the tooltip the befoulment value', () => {
    expect(getWeaponModifiers(befouled).befoulment?.showValue).toBe('-10%')
  })

  it('shows the befoulment value in the weapon stats', () => {
    const rows = weaponStatRows(befouled, '1040001000', 1)
    expect(rows).toContainEqual({
      label: 'Befoulment',
      value: { kind: 'text', text: '-10%' }
    })
  })
})
