<script lang="ts">
  import { GBF_CDN } from '../../../lib/constants.js'
  import {
    renderCharacterStats,
    renderWeaponStats,
    renderSummonStats
  } from '../../../lib/detail-helpers.js'

  interface Props {
    dataType: string
    data: any
  }

  let { dataType, data }: Props = $props()

  let id = $derived(data?.id || data?.master?.id)
  let name = $derived(data?.name || data?.master?.name || 'Unknown')
  let element = $derived(
    data?.attribute || data?.element || data?.master?.attribute || data?.master?.element
  )
  let proficiencies = $derived(
    data?.master?.specialty_weapon || data?.specialty_weapon || []
  )

  let imageUrl = $derived.by(() => {
    if (dataType.startsWith('detail_npc')) return `${GBF_CDN}/npc/m/${id}_01.jpg`
    if (dataType.startsWith('detail_weapon')) return `${GBF_CDN}/weapon/m/${id}.jpg`
    if (dataType.startsWith('detail_summon')) return `${GBF_CDN}/summon/m/${id}.jpg`
    return ''
  })

  let fallbackUrl = $derived.by(() => {
    if (dataType.startsWith('detail_npc')) return `${GBF_CDN}/npc/m/${id}_01_0.jpg`
    return ''
  })

  let imageClass = $derived.by(() => {
    if (dataType.startsWith('detail_npc')) return 'character-main'
    if (dataType.startsWith('detail_weapon')) return 'weapon-main'
    if (dataType.startsWith('detail_summon')) return 'summon-main'
    return ''
  })

  let statsHtml = $derived.by(() => {
    if (dataType.startsWith('detail_npc')) {
      return renderCharacterStats(data, name, id, element, proficiencies)
    }
    if (dataType.startsWith('detail_weapon')) {
      return renderWeaponStats(data, name, id, element, proficiencies[0])
    }
    if (dataType.startsWith('detail_summon')) {
      return renderSummonStats(data, name, id, element)
    }
    return ''
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
    {@html statsHtml}
  </div>
</div>
