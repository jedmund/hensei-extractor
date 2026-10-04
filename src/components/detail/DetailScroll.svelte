<script lang="ts">
  import { onMount, type Snippet } from 'svelte'

  interface Props {
    /** True once the list has scrolled away from the top */
    scrolled?: boolean
    children: Snippet
  }

  let { scrolled = $bindable(false), children }: Props = $props()

  // Each view gets a new list, which starts at the top
  onMount(() => {
    scrolled = false
  })

  function handleScroll(e: Event) {
    const target = e.target as HTMLElement
    scrolled = target.scrollTop > 0
  }
</script>

<div class="detail-items" id="detailItems" onscroll={handleScroll}>
  {@render children()}
</div>
