<script lang="ts">
  /** Uncap stars; each entry is a star's class (see starClasses) */
  interface Props {
    stars: string[] | null
  }

  let { stars }: Props = $props()
</script>

{#if stars}
  <span class="stars">{#each stars as star}<span class="star {star}"></span>{/each}</span>
{/if}
