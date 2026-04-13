<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import Button from '../shared/Button.svelte'
  import Icon from '../shared/Icon.svelte'
  import { getCachedData } from '../../lib/services/chrome-messages.js'

  let open = $state(false)

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    open = !open
  }

  function close() {
    open = false
  }

  async function handleCopy() {
    close()
    const dataType = app.currentDetailDataType
    if (!dataType) return

    try {
      const response = await getCachedData(dataType)
      if (response.error) {
        app.showToast(m.toast_copy_failed())
        return
      }
      const jsonString = JSON.stringify(response.data, null, 2)
      await navigator.clipboard.writeText(jsonString)
      app.showToast(m.toast_copied())
    } catch {
      app.showToast(m.toast_copy_failed())
    }
  }

  async function handleSave() {
    close()
    const dataType = app.currentDetailDataType
    if (!dataType) return

    try {
      const response = await getCachedData(dataType)
      if (response.error) {
        app.showToast(m.toast_save_failed())
        return
      }
      const jsonString = JSON.stringify(response.data, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataType}.json`
      a.click()
      URL.revokeObjectURL(url)
      app.showToast(m.toast_saved_file({ filename: `${dataType}.json` }))
    } catch {
      app.showToast(m.toast_save_failed())
    }
  }
</script>

<svelte:document onclick={close} />

<div class="copy-dropdown">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <Button size="small" iconOnly id="copyDropdownToggle" onclick={toggle}>
    <Icon name="more-vertical" size={16} />
  </Button>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="copy-dropdown-menu" class:open onclick={(e) => e.stopPropagation()}>
    <button class="copy-dropdown-item" data-action="copy" onclick={handleCopy}>
      {m.action_copy()}
    </button>
    <button class="copy-dropdown-item" data-action="save" onclick={handleSave}>
      {m.action_save()}
    </button>
  </div>
</div>
