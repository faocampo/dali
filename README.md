# Dali

Dali extends [DJAI Academy's Open Canvas](https://github.com/DJAI-Academy/djai-open-canvas/tree/27f8bb97b10984e04e48d7650d954d0a7ecd212c) (pinned upstream source) with an editable canvas and authenticated board library. Account boards use the application backend; earlier browser-local boards and images remain in IndexedDB and can be copied into an account. Clearing site data removes browser-local work.

## Run locally

From the repository root:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** after the launcher prints **Dali local development ready**. Choose **Synthetic Owner** on the explicitly labeled synthetic sign-in page, then create a board from the library. This local flow uses signed OIDC and the application's session and board-permission checks. The synthetic accounts are for development; actual-provider acceptance remains a separate operator check.

The launcher compiles the backend and starts Vite, the application API on port **5174**, and the synthetic identity provider on port **5175**, all bound to `127.0.0.1`. **Ctrl+C** stops the services together. Running `npm run dev` again retains local account boards and valid sessions: the SQLite database and generated session secret live in the ignored, private `.gsd/local-dev/` directory. Keep that directory and the same UI/provider ports when restarting. Back up the whole directory while stopped if you need to preserve this local development data. Browser IndexedDB is left intact.

Ports fail explicitly when occupied. `--port <port>` (or `DALI_DEV_UI_PORT`), `DALI_DEV_API_PORT`, and `DALI_DEV_OIDC_PORT` select alternate loopback ports. Use a separate `DALI_DEV_STATE_DIR` for an independent local environment; changing the saved UI/provider origins in an existing directory is rejected to preserve account identity. Keep custom runtime storage outside publishable source. The launcher refuses `NODE_ENV=production`.

For frontend work against an independently configured backend, use:

```sh
DALI_API_PROXY_TARGET=http://127.0.0.1:3000 npm run dev:ui -- --host 127.0.0.1
```

`dev:ui` starts Vite. `DALI_API_PROXY_TARGET` configures `/api` and `/auth` forwarding for both Vite development and preview, defaulting to the backend's loopback port **3000**. Register the matching frontend `/auth/callback` origin with that backend/provider. The browser-test harness selects its own proxy targets and disposable state. Production startup remains [server/app.ts](server/app.ts) (operator-configured application entrypoint), independent of synthetic development/provider code.

## Verify

```sh
npm exec playwright install -- chromium firefox webkit
npm run typecheck
npm test
npm run test:dev
npm run build
npm run test:browser
```

`test:dev` runs a bounded Chromium startup/restart regression using isolated ports and private temporary state, plus port-collision and failed-start cleanup checks. The browser runner starts loopback development and production-preview servers. It runs Chromium against both builds and Firefox/WebKit against the production build. Each test receives isolated browser storage. Unexpected console errors and page exceptions fail tests automatically.

To use a custom browser cache, set `PLAYWRIGHT_BROWSERS_PATH` to the same external directory for both the install and test commands. Test reports and generated builds are ignored by Git.

The optional fixture negative control must fail on the injected page exception:

```sh
DALI_ERROR_CONTROL=1 npm exec playwright test -- tests/community.spec.ts --project=dev --grep 'unexpected page error'
```

Missing targeted suites also fail:

```sh
npm test -- src/canvas/nonexistent-control.test.ts
npm exec playwright test -- tests/nonexistent-control.spec.ts --list
```

## Toolchain and compatibility

The local verification environment uses Node **26.7.0**, npm **11.19.0**, and Playwright **1.62.1** with Chromium **151.0.7922.34**, Firefox **153.0**, and WebKit **26.5**. The inherited `@blocksuite/icons` package declares Node `>=18.19.0 <23.0.0`, so npm warns on Node 26. The checks above establish the tested environment; the engine warning remains an upstream compatibility constraint.

BlockSuite stays at **0.22.4**. Vite **7.3.6**, React plugin **5.2.0**, vanilla-extract plugin **5.2.6**, and Vitest **4.1.11** form the maintained local build. Vite's [release policy](https://vite.dev/releases) (maintained release lines) lists 7.3 for important and security fixes. Its [migration guidance](https://vite.dev/guide/migration) (native decorator limitation in Vite 8's Oxc transform) explains the choice to retain Vite 7's esbuild path for this editor.

The configuration retains ES2022 and assignment-style class fields in both source and dependency transforms, plus vanilla-extract CSS processing. A scoped optimizer hook leaves BlockSuite's raw CSS modules to the normal Vite transform so they receive compiled styles. `tsconfig.blocksuite-paths.json` maps type checking onto shipped declarations; regenerate it with `node scripts/gen-blocksuite-paths.mjs` if the editor package inventory changes. Large inherited syntax-highlighting/editor chunks produce a build size warning.

## License and public content

[LICENSE](LICENSE) (Dali and upstream MIT notices) preserves both copyright and permission notices. Source attribution links to the pinned upstream repository. Examples and verification fixtures use synthetic content. Operator-specific identity and deployment configuration belongs in external operator-controlled infrastructure.
