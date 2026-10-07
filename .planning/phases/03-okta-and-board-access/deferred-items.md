# Deferred Items

- Existing nested BlockSuite Vitest dependency has the moderate advisory [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), reported through eleven package entries. The new access dependency tree has no reported high/critical advisory. Preserve approved canvas pins; resolve the existing nested tool dependency in a separately scoped change.
  status: open
- Existing BlockSuite icons engine range excludes the current verification runtime. Static checks, native SQL smoke, 79 unit cases and the production build pass; supported deployment-runtime acceptance remains later work.
  status: open
