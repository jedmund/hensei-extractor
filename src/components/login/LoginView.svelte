<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
  import WarningCard from './WarningCard.svelte'
  import LoginForm from './LoginForm.svelte'
</script>

<div class="view login-view">
  <div class="login-background"></div>
  <div class="login-content">
    {#if !app.noticeAcknowledged}
      <WarningCard />
    {:else}
      <LoginForm />
    {/if}
  </div>
</div>
