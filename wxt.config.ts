import { defineConfig } from 'wxt'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import path from 'node:path'

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
    ],
    resolve: {
      alias: {
        $themes: path.resolve(__dirname, 'src/styles/themes')
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: [path.resolve(__dirname, 'src/styles')]
        }
      }
    }
  }),
  manifest: {
    name: 'granblue.team',
    description:
      'Passively captures Granblue Fantasy data for export to granblue.team',
    version: process.env.WXT_BUILD_NUMBER ?? '0',
    permissions: ['storage', 'debugger', 'tabs', 'sidePanel', 'cookies'],
    host_permissions: [
      'https://game.granbluefantasy.jp/*',
      'https://granblue.team/*',
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
