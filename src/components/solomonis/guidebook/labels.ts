/** Localized labels for guidebook enums, as in hensei-web's guidebook labels. */

import * as m from '../../../paraglide/messages.js'
import type {
  GuideEffectIconCategory,
  GuidebookRarity
} from '../../../lib/solomonis/guidebook.js'

export function rarityLabel(rarity: GuidebookRarity): string {
  switch (rarity) {
    case 'unique':
      return m.solomonis_extension_rarity_unique()
    case 'rare':
      return m.solomonis_extension_rarity_rare()
    case 'normal':
      return m.solomonis_extension_rarity_normal()
    case 'cursed':
      return m.solomonis_extension_rarity_cursed()
  }
}

export function iconCategoryLabel(category: GuideEffectIconCategory): string {
  switch (category) {
    case 'offence':
      return m.solomonis_extension_icon_offence()
    case 'defence':
      return m.solomonis_extension_icon_defence()
    case 'special':
      return m.solomonis_extension_icon_special()
    case 'cursed':
      return m.solomonis_extension_icon_cursed()
  }
}
