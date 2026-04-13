import { defineConfig } from 'wxt'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  srcDir: 'src',
  vite: () => ({
    plugins: [
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        strategy: ['globalVariable', 'baseLocale'],
        disableAsyncLocalStorage: true
      })
    ]
  }),
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
