import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  srcDir: 'src',
  manifest: {
    name: 'granblue.team',
    description:
      'Passively captures Granblue Fantasy data for export to granblue.team',
    permissions: ['storage', 'debugger', 'tabs', 'sidePanel'],
    host_permissions: [
      'https://game.granbluefantasy.jp/*',
      'https://api.granblue.team/*',
      'https://next-api.granblue.team/*'
    ],
    action: {
      default_icon: {
        '16': 'icon16.png',
        '48': 'icon48.png',
        '128': 'icon128.png'
      }
    }
  }
})
