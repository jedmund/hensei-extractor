# hensei-extractor

The Chrome extension for [granblue.team](https://granblue.team). While you play Granblue Fantasy in the browser, it reads the data the game page already receives and lets you send it to your granblue.team account from a side panel:

- parties from the party screen
- your characters, weapons, summons and artifacts, from the list and collection pages
- character, weapon and summon detail pages
- Wonders, support summons, crew info and Unite and Fight scores

It's built with [WXT](https://wxt.dev), Svelte 5 and TypeScript, with Paraglide for English and Japanese. It talks to the Rails API in [jedmund/hensei-api](https://github.com/jedmund/hensei-api), and logs in through the website in [jedmund/hensei-web](https://github.com/jedmund/hensei-web).

## How it works

The background script (`src/entrypoints/background.ts`) attaches Chrome's `debugger` to game tabs and watches their network responses. It only attaches to the game domains in `GBF_DOMAINS` (`src/lib/intercept-routes.ts`) and detaches when a tab leaves the game. Each response is matched against the URL rules in `intercept-routes.ts`, parsed (`src/lib/parsers/`) and cached. The side panel (`src/entrypoints/sidepanel/`) lists what's been captured and sends it to the API.

## Setup

You need Node 22 or newer (CI uses 22) and pnpm 10. With Corepack, `corepack enable` picks up the pnpm version pinned in `package.json`.

```sh
git clone https://github.com/jedmund/hensei-extractor.git
cd hensei-extractor
pnpm install
```

## Commands

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Builds to `.output/chrome-mv3-dev/` and rebuilds on every change |
| `pnpm build`        | Production build in `.output/chrome-mv3/`                        |
| `pnpm zip`          | Zips the production build for distribution                       |
| `pnpm test`         | Unit tests (Vitest)                                              |
| `pnpm lint`         | ESLint                                                           |
| `pnpm format:check` | Prettier check (CI runs this separately from `lint`)             |
| `pnpm format`       | Format everything with Prettier                                  |

## Loading the extension

`pnpm dev` opens a new Chrome window with the dev build already loaded, and reloads the extension when you save.

To load a build in your own Chrome profile instead:

1. Run `pnpm build`, or `pnpm dev` for the dev build.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose `.output/chrome-mv3/` (or `.output/chrome-mv3-dev/`).
4. Open the game, then click the extension's toolbar icon to open the side panel.

Unpacked builds include a manifest key, so the extension ID is always `lcobmjandcaicggiddpheahpogbdodid`, whatever folder you load it from. Logging in through granblue.team only redirects back to allowlisted IDs (`EXTENSION_IDS` in the web app), and the fixed ID keeps unpacked installs on that list. Store builds (`WXT_STORE_BUILD=true`) leave the key out, because the Chrome Web Store assigns its own ID.

## Which API it uses

**Every build talks to production.** Both entries in `ENVIRONMENTS` (`src/lib/constants.ts`) point at `https://api.granblue.team` and `https://granblue.team`, so anything you import from a dev build goes to your real account.

There's no setting yet for pointing it at a local API. Until there is, you have to change it locally. This setup hasn't been tested end to end, and these changes shouldn't be committed:

1. In `src/lib/constants.ts`, change the `development` entry to `apiUrl: 'http://localhost:3000'`, `apiPath: '/api/v1'` and `siteUrl: 'http://localhost:5174'`.
2. In `wxt.config.ts`, add `http://localhost:3000/*` and `http://localhost:5174/*` to `host_permissions`.
3. In the web app's `.env.local`, add the unpacked ID to `EXTENSION_IDS` so that logging in through your local site redirects back to the extension:

   ```dotenv
   EXTENSION_IDS=lcobmjandcaicggiddpheahpogbdodid
   ```

4. Start [hensei-api](https://github.com/jedmund/hensei-api#initial-setup) and [hensei-web](https://github.com/jedmund/hensei-web#setup) locally, then reload the extension.

## Building for distribution

`pnpm zip` builds the extension and zips it in `.output/`. Two variables (see `.env.example`) change the build:

- `WXT_BUILD_NUMBER` sets the manifest version. Without it, the version is `0`.
- `WXT_STORE_BUILD=true` leaves the manifest key out, which the Chrome Web Store requires. The store then assigns its own extension ID.

Every build talks to the granblue.team API (see above), so a copy for your own servers also needs `ENVIRONMENTS` and `host_permissions` changed.

## Contributing

Branch from `staging` and open pull requests into it.

## License

See [LICENSE](LICENSE).
