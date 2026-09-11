// Regenerates tsconfig.blocksuite-paths.json after a BlockSuite version bump.
//   node scripts/gen-blocksuite-paths.mjs
//
// BlockSuite 0.22 publishes raw TypeScript -- every package's `exports` field
// points at ./src/*.ts. tsc therefore type-checks ~1800 errors' worth of their
// source under our strict flags (skipLibCheck only covers .d.ts). Each package
// does also ship built declarations under dist/, so we map type resolution
// there. Vite still follows the real `exports` at runtime.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = 'node_modules/@blocksuite';
const pkgs = readdirSync(base)
  .filter((d) => statSync(join(base, d)).isDirectory())
  .sort();

const paths = {};
for (const p of pkgs) {
  paths[`@blocksuite/${p}`] = [`./${base}/${p}/dist/index.d.ts`, `./${base}/${p}/dist`];
  paths[`@blocksuite/${p}/*`] = [`./${base}/${p}/dist/*`];
}

writeFileSync(
  'tsconfig.blocksuite-paths.json',
  `${JSON.stringify(
    {
      '//': 'GENERATED -- run: node scripts/gen-blocksuite-paths.mjs',
      compilerOptions: { paths },
    },
    null,
    2
  )}\n`
);
console.log(`mapped ${pkgs.length} packages (${Object.keys(paths).length} entries)`);
