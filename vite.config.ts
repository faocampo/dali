/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';

// SPIKE NOTE (BlockSuite 0.22):
// @blocksuite/* publishes RAW TypeScript (package exports point at ./src/*.ts).
// Two consequences:
//  1. Vite has to transpile node_modules TS. That works, but esbuild only LOWERS
//     TC39 decorators (BlockSuite/Lit use `accessor` + `@property`) when the
//     target is below `esnext`. With the default esnext target the decorators are
//     emitted verbatim and Chrome throws `SyntaxError: Invalid or unexpected
//     token` on e.g. @blocksuite/std/src/view/element/block-component.ts.
//     => pin target to es2022 for the dep optimizer AND the source transform.
//  2. Every BlockSuite subpath we import should be pre-bundled, otherwise Vite
//     serves hundreds of individual .ts files per page load.
/** Optional generic asset base; operator values stay outside this repository. */
const base = process.env.DEPLOY_BASE ?? '/';

export default defineConfig(() => {
  return {
    base,
  //  3. BlockSuite styles edgeless notes / the outline fragment with
  //     vanilla-extract `*.css.ts` files. Vite's dep optimizer externalizes those,
  //     so without @vanilla-extract/vite-plugin the browser is handed the raw
  //     @vanilla-extract/css *runtime* (plus ~900 unbundled node_modules requests)
  //     and dies on `deepmerge` CJS interop.
    plugins: [
      react(),
      vanillaExtractPlugin(),
    ],
  esbuild: {
    target: 'es2022',
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
  },
  optimizeDeps: {
    // Every BlockSuite subpath we use, pre-bundled explicitly.
    // BlockSuite's root and toolbar packages still import database selection at
    // module scope. Keep these initialization dependencies bundled together
    // even though this edition does not register a database canvas feature.
    include: [
      // Not ours, and not optional: affine-block-root and affine-widget-toolbar
      // both import DatabaseSelection from affine-block-database, which reads
      // `viewPresets` from data-view at module scope. Naming both as explicit
      // pre-bundle entries is what makes esbuild evaluate data-view first.
      '@blocksuite/data-view',
      '@blocksuite/affine-block-database',
      '@blocksuite/affine-widget-edgeless-selected-rect/view',
      '@blocksuite/affine-widget-edgeless-zoom-toolbar/view',
      '@blocksuite/affine/blocks/edgeless-text/store',
      '@blocksuite/affine/blocks/edgeless-text/view',
      '@blocksuite/affine/blocks/frame/store',
      '@blocksuite/affine/blocks/frame/view',
      '@blocksuite/affine/blocks/image/store',
      '@blocksuite/affine/blocks/image/view',
      '@blocksuite/affine/blocks/list/store',
      '@blocksuite/affine/blocks/list/view',
      '@blocksuite/affine/blocks/note/store',
      '@blocksuite/affine/blocks/note/view',
      '@blocksuite/affine/blocks/paragraph/store',
      '@blocksuite/affine/blocks/paragraph/view',
      '@blocksuite/affine/blocks/root/store',
      '@blocksuite/affine/blocks/root/view',
      '@blocksuite/affine/blocks/surface/store',
      '@blocksuite/affine/blocks/surface/view',
      '@blocksuite/affine/ext-loader',
      '@blocksuite/affine/foundation/store',
      '@blocksuite/affine/foundation/view',
      '@blocksuite/affine/gfx/brush/store',
      '@blocksuite/affine/gfx/brush/view',
      '@blocksuite/affine/gfx/connector/store',
      '@blocksuite/affine/gfx/connector/view',
      '@blocksuite/affine/gfx/group/store',
      '@blocksuite/affine/gfx/group/view',
      '@blocksuite/affine/gfx/note/view',
      '@blocksuite/affine/gfx/pointer/view',
      '@blocksuite/affine/gfx/shape/store',
      '@blocksuite/affine/gfx/shape/view',
      '@blocksuite/affine/gfx/text/store',
      '@blocksuite/affine/gfx/text/view',
      '@blocksuite/affine/inlines/footnote/store',
      '@blocksuite/affine/inlines/footnote/view',
      '@blocksuite/affine/inlines/latex/store',
      '@blocksuite/affine/inlines/latex/view',
      '@blocksuite/affine/inlines/link/store',
      '@blocksuite/affine/inlines/link/view',
      '@blocksuite/affine/inlines/mention/view',
      '@blocksuite/affine/inlines/preset/store',
      '@blocksuite/affine/inlines/preset/view',
      '@blocksuite/affine/inlines/reference/store',
      '@blocksuite/affine/inlines/reference/view',
      '@blocksuite/affine/std',
      '@blocksuite/affine/store',
      '@blocksuite/affine/store/test',
      '@blocksuite/affine/sync',
      '@blocksuite/affine/widgets/edgeless-dragging-area/view',
      '@blocksuite/affine/widgets/edgeless-toolbar/view',
      '@blocksuite/affine/widgets/frame-title/view',
      '@blocksuite/affine/widgets/toolbar/view',
    ],
    esbuildOptions: {
      target: 'es2022',
      // BlockSuite compiles with useDefineForClassFields: false, and depends on
      // it. E.g. global/src/di/provider.ts ServiceResolver does
      //   container = this.provider.container;
      // where `provider` is a constructor parameter property. Under `false` (see
      // their dist/di/provider.js) params are assigned before field
      // initializers, so this works. Under `true` the native-class-field
      // initializer runs first and `this.provider` is still undefined ->
      // "Cannot read properties of undefined (reading 'container')" the moment
      // anything constructs a Store.
      // node_modules has no tsconfig, so esbuild would otherwise default this to
      // `true` because our target is es2022. Force their semantics.
      tsconfigRaw: {
        compilerOptions: {
          target: 'es2022',
          useDefineForClassFields: false,
        },
      },
    },
  },
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // A missing targeted unit suite must fail verification.
    passWithNoTests: false,
  },
  };
});
