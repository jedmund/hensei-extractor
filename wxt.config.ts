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
    // Public key that pins the extension ID to lcobmjandcaicggiddpheahpogbdodid
    // for every unpacked install, whatever folder it's loaded from. Logging in
    // through granblue.team only redirects to allowlisted IDs (EXTENSION_IDS).
    // The private key isn't needed for unpacked installs and isn't kept.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAneysCmA4/TSeufKcsRbxlEkoick7MsfftmKKlqPsrtwekK1IM8+uftN53WwOyXcHwkgMSd68TBJIgH6QgtJt2vj56Myp+U0dJ43byt9t5KgjtjQ2pDyBPHAaSNYaKeRPdyykqfk6lE/n7UkbbQhypBKRB2eJiL8iN1RY/55vePmW2QjGkdjaj7qPwc2WtVy4P6+9gRXCuY3qH7jS/pJPNI0OS4R7iqOVPV7LLvyUbfEhg+8BLlIWAzoS/f3pDHIepTL8OCukwQomBySqqeE92elqQudMw+TWeGX5zl5qb94ZSqkWYger1RpISyF31hGTxFtdeClM60Q4MTg0ktP6gwIDAQAB',
    permissions: [
      'storage',
      'debugger',
      'tabs',
      'sidePanel',
      'cookies',
      'identity'
    ],
    host_permissions: [
      'https://game.granbluefantasy.jp/*',
      'https://gbf.game.mbga.jp/*',
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
