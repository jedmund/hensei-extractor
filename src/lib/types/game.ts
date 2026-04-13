/**
 * Raw game data shapes as received from the GBF API.
 * These are snake_case matching the game's response format,
 * distinct from the camelCase types in hensei-svelte.
 */

/** Element IDs as used by the GBF API */
export type GameElementId = 1 | 2 | 3 | 4 | 5 | 6

/** Rarity IDs as used by the GBF API */
export type GameRarityId = 2 | 3 | 4

/** Master data for any game entity (character, weapon, summon) */
export interface GameMaster {
  id: string
  name: string
  series_id?: number
  attribute?: string
  rarity?: string
}

/** Param data for game entities */
export interface GameParam {
  evolution?: number
  phase?: number
  image_id?: string
  arousal?: {
    form_id?: number
    level?: number
    is_arousal?: boolean
  }
  level?: string
  quality?: string
  hp?: string
  attack?: string
}

/** A character entry from the game's character list/collection */
export interface GameCharacterEntry {
  master: GameMaster & {
    attribute?: string
  }
  param: GameParam
  is_npc?: boolean
}

/** A weapon entry from the game's weapon list/collection */
export interface GameWeaponEntry {
  master: GameMaster
  param: GameParam & {
    skill1?: GameWeaponSkill
    skill2?: GameWeaponSkill
    skill3?: GameWeaponSkill
    augment_skill1?: GameAugmentSkill
    augment_skill2?: GameAugmentSkill
    augment_skill3?: GameAugmentSkill
  }
}

/** A summon entry from the game's summon list/collection */
export interface GameSummonEntry {
  master: GameMaster
  param: GameParam
}

/** Weapon skill data from the game */
export interface GameWeaponSkill {
  name?: string
  image?: string
  description?: string
  level?: string
}

/** Augment (AX/Befoulment) skill from the game */
export interface GameAugmentSkill {
  show_info?: string
  image?: string
  skill_name?: string
  effect_value?: string
}

/** Over-mastery modifier from the game */
export interface GameOverMasteryMod {
  type?: {
    id?: number
    name?: string
    image?: string
  }
  param?: string
  disp_param?: string
  split_key?: string
}

/** Aetherial mastery modifier from the game */
export interface GameAetherialMod {
  type?: {
    id?: number
    name?: string
    image?: string
  }
  param?: string
}

/** Perpetuity bonus from the game */
export interface GamePerpetuityBonus {
  type?: {
    id?: number
    name?: string
    image?: string
  }
  param?: string
}

/** Party deck data from the game */
export interface GameDeck {
  pc: {
    job: {
      id?: string
      master?: {
        id?: string
        name?: string
        image?: string
      }
    }
    param?: Record<string, unknown>
    weapons?: Record<string, GameWeaponEntry | null>
    sub_weapons?: Record<string, GameWeaponEntry | null>
    summons?: Record<string, GameSummonEntry | null>
    sub_summons?: Record<string, GameSummonEntry | null>
    damage_info?: Record<string, unknown>
  }
  npc: Record<string, GameCharacterEntry | null>
}

/** Artifact entry from the game */
export interface GameArtifactEntry {
  master: {
    id: string
    name: string
    comment?: string
  }
  param: {
    image_id?: string
    level?: string
    quality?: string
  }
}
