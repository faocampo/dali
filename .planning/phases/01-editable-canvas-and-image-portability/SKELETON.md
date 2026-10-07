# Walking Skeleton — Dali

**Phase:** 1
**Generated:** 2026-09-11
**Status:** Planning contract; execution evidence pending.

## Capability to Prove End-to-End

A local user opens the app, creates and edits a sticky note, reloads, and reads the same native object from IndexedDB. Image input and PNG output expand this working path.

Approved phase goal: Users can compose and arrange editable canvas content, incorporate reference images, and take useful image exports away from the board.

Derived framing: **As a** canvas user, **I want to** compose editable content with reference images and export it, **so that** I can develop and share visual plans.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Foundation | DJAI Academy revision 27f8bb97b10984e04e48d7650d954d0a7ecd212c, with applicable MIT notices | Approved extension foundation. |
| Framework | Existing React/TypeScript/Vite frontend and native BlockSuite 0.22.4 document/view model | Preserve native primitives and installed contracts; toolchain maintenance is isolated and verified. |
| Data layer | Real browser IndexedDB plus existing catalog/preferences | Proves local write/read with native image blobs; keys remain unchanged. |
| Auth | Phase 3 owns configurable OIDC and board permissions | Phase 1 interaction uses local board identity. |
| Deployment | Documented loopback development and production-preview commands | Exercises the complete phase stack locally. Operator deployment belongs to Phase 4. |
| Layout | Existing src/canvas, src/boards, src/header modules; left drawing toolbar and selection controls | Keeps the approved interaction seams and native registration. |
| Images | One validated native insertion adapter for picker/drop/paste | Preserve proportions, coordinates, event ownership and stored blobs. |
| Export | Shared pure plan plus native primitive/DOM rendering and browser PNG encoding | Preview and output agree; requested source scale must be proven before adapter acceptance. |
| Entity identity | Native polymorphic canvas entity; no-change | Images already coexist with editable native entities without a new identity model. |

## Stack Touched in Phase 1

- [ ] Incorporate the 45-file reviewed source closure, build/typecheck/unit/browser harness and notices.
- [ ] Open the root application and select its local board through the retained shell.
- [ ] Read and write a real native document and image blobs through IndexedDB.
- [ ] Trigger native store actions from real UI input.
- [ ] Run locally using the documented npm commands.
- [ ] Decode actual PNG downloads and verify their content and dimensions.

Checkboxes record implementation evidence only after execution.

## Subsequent Slices

Phase 2 adds daily mind maps. Phase 3 adds sign-in and authorized board access. Phase 4 adds shared durable storage, recovery and operator deployment. Phase 5 adds collaborative editing, presence and participant-specific undo. Later phases add their approved facilitation, template, mockup, diagram and Gantt capabilities. MCP and Plane retain their deferred allocation; ClickUp imports remain excluded.

## Source

DJAI Academy [pinned repository](https://github.com/DJAI-Academy/djai-open-canvas/tree/27f8bb97b10984e04e48d7650d954d0a7ecd212c) (incorporation source); [01-01-PLAN.md](01-01-PLAN.md) (local write/read and toolchain execution); [01-CONTEXT.md](01-CONTEXT.md) (approved controls and image behavior).
