<!-- The Sephira coins an expedition obtained and how many shop purchases it
     made. Matches hensei-web's EconomySection. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import DetailRow from '../../shared/details/DetailRow.svelte'
  import DetailsSection from '../../shared/details/DetailsSection.svelte'

  interface Props {
    pointsEarned: number | null
    shopPurchases: number | null
  }

  let { pointsEarned, shopPurchases }: Props = $props()
</script>

<DetailsSection title={m.solomonis_extension_economy()}>
  <div class="rows">
    <DetailRow label={m.solomonis_extension_points_earned()} value={pointsEarned} />
    <DetailRow label={m.solomonis_extension_shop_purchases()} value={shopPurchases} />
  </div>
</DetailsSection>

<style lang="scss">
  .rows {
    display: flex;
    flex-direction: column;
  }
</style>
