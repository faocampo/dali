# Dali

Dali extends [DJAI Academy's Open Canvas](https://github.com/DJAI-Academy/djai-open-canvas/tree/27f8bb97b10984e04e48d7650d954d0a7ecd212c) (pinned upstream source) with a local editable canvas. The current foundation stores boards and image blobs in browser IndexedDB; board selection and the board catalog use browser storage. Clearing site data removes local work. Shared storage, authenticated access and collaboration follow the approved roadmap.

## Run locally

From the repository root:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the loopback URL printed by Vite. Use **Add sticky note**, double-click the note to type, and wait for **Saved locally** before reloading. The board switcher opens the local board library. **Save failed** exposes recovery actions when browser storage rejects a write.

## Verify

```sh
npm exec playwright install -- chromium firefox webkit
npm run typecheck
npm test
npm run build
npm run test:browser
```

The browser runner starts loopback development and production-preview servers. It runs Chromium against both builds and Firefox/WebKit against the production build. Each test receives isolated browser storage. Unexpected console errors and page exceptions fail tests automatically.

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
