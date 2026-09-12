---
id: SEED-003
status: dormant
planted: 2026-09-12
planted_during: Phase 2 — Daily Mind Maps, before planning
trigger_when: When the UI/UX is considered complete
scope: Dali brand assets and naming; effort to be estimated
---

# SEED-003: Dali brand assets and naming

## Idea

When the UI/UX is considered complete, use the SVG and PNG image directories within `imgs/` as the source for application logos, favicons, and all associated Dali brand images. Replace DJAI product-brand references with the Dali name.

## Why This Matters

Apply a consistent Dali identity across the completed application using the supplied brand assets.

## When to Surface

**Trigger:** When the UI/UX is considered complete.

Surface during final UI/UX completion and branding planning. GSD also surfaces matching seeds during new-milestone planning.

## Scope Estimate

- Inventory the supplied SVG and PNG assets in `imgs/` and choose suitable variants for each branding surface.
- Update application logos, favicons, page titles, metadata, accessible names, and associated brand images.
- Replace DJAI product naming throughout application-facing copy with Dali.
- Preserve applicable upstream copyright, license notices, and attribution under the project's approved contribution requirements.
- Validate asset rendering, favicon loading, accessible names, and remaining product-brand references.

Effort and the exact asset-to-surface mapping remain for implementation planning. Review asset suitability for public inclusion before staging assets.

## Breadcrumbs

- `imgs/` — user-designated source of SVG and PNG brand assets.
- `src/header/Header.tsx` — current logo, accessible branding, and header copy.
- `src/assets/djai-design-logo.png` — current application logo.
- `index.html` — document title and description metadata.
- `src/header/links.ts` — upstream reference link to consider alongside attribution requirements.
- `.planning/PROJECT.md` — product identity and upstream attribution constraints.
- `.planning/STATE.md` — current phase and progress toward UI/UX completion.

## Notes

Captured as deferred branding work. The trigger does not change the current approved phase sequence.
