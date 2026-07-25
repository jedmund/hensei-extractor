import { CACHE_KEYS, CACHE_TTL_MS } from '../constants.js'
import {
  OVER_MASTERY_TYPE_ID,
  lookupAetherialTypeId,
  PERPETUITY_TYPE_ID,
  parseDisplayValue
} from '../mastery.js'
import type { CharacterStatsEntry, ParsedMasteryData } from './types.js'

export async function cacheCharacterStats(
  dataType: string,
  data: Record<string, unknown>,
  masterId: string | null,
  timestamp: number,
  _url: string
): Promise<boolean> {
  const result = await chrome.storage.local.get(CACHE_KEYS.character_stats)
  const existing: {
    lastUpdated: number | null
    updates: Record<string, CharacterStatsEntry>
    characterCount?: number
  } = (result[CACHE_KEYS.character_stats!] as {
    lastUpdated: number | null
    updates: Record<string, CharacterStatsEntry>
    characterCount?: number
  }) ?? {
    lastUpdated: null,
    updates: {}
  }

  if (existing.lastUpdated && timestamp - existing.lastUpdated > CACHE_TTL_MS) {
    existing.updates = {}
  }

  const master = data.master as Record<string, unknown> | undefined
  const resolvedMasterId = (master?.id as string) ?? masterId
  if (!resolvedMasterId) {
    console.warn('[Background] No master_id found for character stats')
    return false
  }

  const current: CharacterStatsEntry = existing.updates[resolvedMasterId] ?? {
    masterId: resolvedMasterId
  }

  if (!current.rawData) current.rawData = {}
  if (dataType === 'character_detail') {
    current.rawData.character_detail = {
      master: {
        id: master?.id,
        name: master?.name,
        attribute: master?.attribute
      },
      param: data.param,
      npc_arousal_form: data.npc_arousal_form,
      npc_arousal_form_text: data.npc_arousal_form_text,
      npc_arousal_level: data.npc_arousal_level,
      has_npcaugment_constant: data.has_npcaugment_constant,
      attribute: data.attribute,
      element: data.element
    }
  } else if (dataType === 'zenith_npc') {
    const option = data.option as Record<string, unknown> | undefined
    const npcaugment = option?.npcaugment as Record<string, unknown> | undefined
    if (npcaugment) {
      current.rawData.zenith_npc = {
        param_data: npcaugment.param_data ?? null,
        constant_data_list: npcaugment.constant_data_list ?? null
      }
    }
  }

  if (dataType === 'character_detail') {
    current.masterName = (master?.name as string) ?? current.masterName
    current.timestamp = timestamp

    const element =
      data.attribute ?? data.element ?? master?.attribute ?? master?.element
    if (element) {
      current.element = element as string | number
    }

    const param = data.param as Record<string, unknown> | undefined
    const evolution = param?.evolution
    if (evolution != null) {
      current.uncapLevel = parseInt(String(evolution), 10)
    }
    const phase = param?.phase
    if (phase != null) {
      const transcendence = parseInt(String(phase), 10)
      if (transcendence > 0) {
        current.transcendenceStep = transcendence
      }
    }

    if (data.npc_arousal_form) {
      current.awakening = {
        type: data.npc_arousal_form,
        typeName: data.npc_arousal_form_text as string | undefined,
        level: (data.npc_arousal_level as number) ?? 1
      }
    }

    if (data.has_npcaugment_constant !== undefined) {
      current.perpetuity = !!data.has_npcaugment_constant
    }
  } else if (dataType === 'zenith_npc') {
    current.timestamp = timestamp

    const masteryData = parseZenithMasteryData(data)

    if (masteryData.masterName && !current.masterName) {
      current.masterName = masteryData.masterName
    }

    if (masteryData.rings.length > 0) {
      current.rings = masteryData.rings
    }
    if (masteryData.earring) {
      current.earring = masteryData.earring
    }
    if (masteryData.perpetuityBonuses.length > 0) {
      current.perpetuityBonuses = masteryData.perpetuityBonuses
    }
  }

  existing.updates[resolvedMasterId] = current
  existing.lastUpdated = timestamp
  existing.characterCount = Object.keys(existing.updates).length

  await chrome.storage.local.set({
    [CACHE_KEYS.character_stats!]: existing
  })
  return true
}

export function parseZenithMasteryData(
  data: Record<string, unknown>
): ParsedMasteryData {
  const result: ParsedMasteryData = {
    rings: [],
    earring: null,
    masterName: null,
    perpetuityBonuses: []
  }

  const option = data.option as Record<string, unknown> | undefined
  const character = option?.character as Record<string, unknown> | undefined
  if (character?.name) {
    result.masterName = character.name as string
  }

  const npcaugment = option?.npcaugment as Record<string, unknown> | undefined
  const paramData = npcaugment?.param_data
  if (Array.isArray(paramData)) {
    for (const bonus of paramData) {
      if (!bonus?.type?.id || !bonus?.param) continue

      const typeId = bonus.type.id as number
      const typeName = bonus.type.name as string
      const slotNum = bonus.slot_number as number
      const strength = parseDisplayValue(bonus.param.disp_total_param)

      if (strength === 0) continue

      if (slotNum === 1) {
        const modifierId = bonus.type.split_key === 0 ? 1 : 2
        result.rings.push({
          modifier: modifierId,
          strength,
          typeName,
          slot: slotNum
        })
        continue
      }

      if (slotNum === 5) {
        continue
      }

      if (slotNum === 4) {
        const modifierId = lookupAetherialTypeId(typeId)
        if (modifierId) {
          result.earring = { modifier: modifierId, strength, typeName }
        }
        continue
      }

      const modifierId = OVER_MASTERY_TYPE_ID[typeId]
      if (modifierId) {
        result.rings.push({
          modifier: modifierId,
          strength,
          typeName,
          slot: slotNum
        })
      }
    }
  }

  const constantData = npcaugment?.constant_data_list as
    | Record<string, unknown[]>
    | undefined
  if (constantData) {
    for (const bonuses of Object.values(constantData)) {
      if (!Array.isArray(bonuses)) continue
      for (const bonus of bonuses) {
        const b = bonus as Record<string, unknown>
        const bType = b.type as Record<string, unknown> | undefined
        const bParam = b.param as Record<string, unknown> | undefined
        if (!bType?.id || !bParam) continue
        const perpetuityId = PERPETUITY_TYPE_ID[bType.id as number]
        if (perpetuityId) {
          result.perpetuityBonuses.push({
            modifier: perpetuityId,
            strength: parseDisplayValue(
              bParam.disp_total_param as string | undefined
            ),
            typeName: bType.name as string
          })
        }
      }
    }
  }

  return result
}
