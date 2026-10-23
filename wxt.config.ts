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
    // The Chrome Web Store rejects a manifest with a key and assigns its own
    // ID, so store builds (WXT_STORE_BUILD=true) leave it out.
    key:
      process.env.WXT_STORE_BUILD === 'true'
        ? undefined
        : 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAneysCmA4/TSeufKcsRbxlEkoick7MsfftmKKlqPsrtwekK1IM8+uftN53WwOyXcHwkgMSd68TBJIgH6QgtJt2vj56Myp+U0dJ43byt9t5KgjtjQ2pDyBPHAaSNYaKeRPdyykqfk6lE/n7UkbbQhypBKRB2eJiL8iN1RY/55vePmW2QjGkdjaj7qPwc2WtVy4P6+9gRXCuY3qH7jS/pJPNI0OS4R7iqOVPV7LLvyUbfEhg+8BLlIWAzoS/f3pDHIepTL8OCukwQomBySqqeE92elqQudMw+TWeGX5zl5qb94ZSqkWYger1RpISyF31hGTxFtdeClM60Q4MTg0ktP6gwIDAQAB',
    // `debugger` is how game data is captured: it reads the responses the
    // game page already receives. Chrome doesn't scope it by
    // host_permissions, so the extension does: it only attaches to tabs on
    // GBF_DOMAINS (src/lib/intercept-routes.ts), re-checks the URL right
    // before attaching, and detaches when a tab leaves the game.
    permissions: [
      'storage',
      'debugger',
      'tabs',
      'sidePanel',
      'cookies',
      'identity'
    ],
    // The game hosts here aren't what capture depends on (that's the
    // debugger check above). steam.granbluefantasy.com is in GBF_DOMAINS
    // but not here on purpose: adding a host can make Chrome ask existing
    // users to approve the update before the extension runs again.
    host_permissions: [
      'https://game.granbluefantasy.jp/*',
      'https://gbf.game.mbga.jp/*',
      'https://granblue.team/*',
      'https://api.granblue.team/*'
    ],
    // The small sizes are cropped to the art so it fills the toolbar; only
    // the 128px store icon keeps Chrome's recommended padding
    icons: {
      '16': 'icon16.png',
      '32': 'icon32.png',
      '48': 'icon48.png',
      '128': 'icon128.png'
    },
    action: {
      default_icon: {
        '16': 'icon16.png',
        '24': 'icon24.png',
        '32': 'icon32.png',
        '48': 'icon48.png'
      }
    }
  }
})
