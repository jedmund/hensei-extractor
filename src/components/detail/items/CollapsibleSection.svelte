<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Collapsible } from 'bits-ui'
  import { app } from '../../../lib/state/app.svelte.js'
  import Checkbox from '../../shared/Checkbox.svelte'

  interface Props {
    title: string
    count: number
    defaultOpen?: boolean
    indices: number[]
    element?: 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark'
    children: Snippet
  }

  let { title, count, defaultOpen = false, indices, element, children }: Props = $props()
  let userToggled = $state(false)
  let open = $state(defaultOpen)

  // Sync with defaultOpen until user manually toggles
  $effect(() => {
    if (!userToggled) {
      open = defaultOpen
    }
  })

  let checkedCount = $derived(
    indices.filter((i) => app.selectedItems.has(i)).length
  )
  let sectionState = $derived.by(() => {
    if (indices.length === 0) return 'unchecked'
    if (checkedCount === 0) return 'unchecked'
    if (checkedCount === indices.length) return 'checked'
    return 'indeterminate'
  })

  function toggleSectionSelect(_checked: boolean) {
    const next = new Set(app.selectedItems)
    const unchecked = new Set(app.manuallyUnchecked)
    if (sectionState === 'checked') {
      for (const i of indices) {
        next.delete(i)
        unchecked.add(i)
      }
    } else {
      for (const i of indices) {
        next.add(i)
        unchecked.delete(i)
      }
    }
    app.selectedItems = next
    app.manuallyUnchecked = unchecked
  }
</script>

<Collapsible.Root bind:open class="collapsible-section">
  <div class="collapsible-header">
    <Checkbox
      checked={sectionState === 'checked'}
      indeterminate={sectionState === 'indeterminate'}
      onCheckedChange={toggleSectionSelect}
      contained
      size="small"
      {element}
    />
    <Collapsible.Trigger class="collapsible-trigger" onclick={() => userToggled = true}>
      <span class="collapsible-title">{title}</span>
      <span class="collapsible-count">{count}</span>
    </Collapsible.Trigger>
  </div>
  <Collapsible.Content class="collapsible-content">
    {@render children()}
  </Collapsible.Content>
</Collapsible.Root>
