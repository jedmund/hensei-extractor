<script lang="ts">
  import { GBF_CDN } from '../../../lib/constants.js'
  import type { RawGameItem } from '../../../lib/detail-helpers.js'
  import {
    characterStatRows,
    weaponStatRows,
    summonStatRows,
    itemCommentLines,
    type StatRowData
  } from '../../../lib/item-stats.js'
  import * as m from '../../../paraglide/messages.js'
  import ItemStats from '../stats/ItemStats.svelte'

  interface DatabaseItemData {
    id?: string
    name?: string
    attribute?: string | number
    element?: string | number
    specialty_weapon?: Array<string | number>
    master?: {
      id?: string
      name?: string
      attribute?: string | number
      element?: string | number
      specialty_weapon?: Array<string | number>
      [key: string]: unknown
    }
    param?: Record<string, unknown>
    [key: string]: unknown
  }

  interface Props {
    dataType: string
    data: Record<string, unknown>
  }

  let { dataType, data: rawData }: Props = $props()

  let data = $derived(rawData as DatabaseItemData)
  let id = $derived(data?.id || data?.master?.id || '')
  let name = $derived(data?.name || data?.master?.name || m.name_unknown())
  let element = $derived(
    data?.attribute || data?.element || data?.master?.attribute || data?.master?.element
  )
  let proficiencies = $derived(
    data?.master?.specialty_weapon || data?.specialty_weapon || []
  )

  let imageUrl = $derived.by(() => {
    if (dataType.startsWith('detail_npc')) return `${GBF_CDN}/npc/detail/${id}_01.png`
    if (dataType.startsWith('detail_weapon')) return `${GBF_CDN}/weapon/b/${id}.png`
    if (dataType.startsWith('detail_summon')) return `${GBF_CDN}/summon/detail/${id}.png`
    return ''
  })

  let fallbackUrl = $derived.by(() => {
    if (dataType.startsWith('detail_npc')) return `${GBF_CDN}/npc/detail/${id}_01_0.png`
    return ''
  })

  let imageClass = $derived.by(() => {
    if (dataType.startsWith('detail_npc')) return 'character-main'
    if (dataType.startsWith('detail_weapon')) return 'weapon-main'
    if (dataType.startsWith('detail_summon')) return 'summon-main'
    return ''
  })

  let item = $derived(data as RawGameItem)
  let statRows = $derived.by((): StatRowData[] | null => {
    if (dataType.startsWith('detail_npc')) {
      return characterStatRows(item, id, element, proficiencies)
    }
    if (dataType.startsWith('detail_weapon')) {
      return weaponStatRows(item, id, element, proficiencies[0])
    }
    if (dataType.startsWith('detail_summon')) {
      return summonStatRows(item, id, element)
    }
    return null
  })

  function handleImageError(e: Event) {
    const img = e.target as HTMLImageElement
    if (fallbackUrl && img.src !== fallbackUrl) {
      img.onerror = null
      img.src = fallbackUrl
    }
  }
</script>

<div class="database-detail">
  <div class="database-detail-image {imageClass}">
    <img src={imageUrl} alt={name} onerror={handleImageError} />
  </div>
  <div class="database-detail-info">
    {#if statRows}
      <ItemStats rows={statRows} comment={itemCommentLines(item)} />
    {/if}
  </div>
</div>
