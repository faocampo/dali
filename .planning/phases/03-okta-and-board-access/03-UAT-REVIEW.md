# Phase 3 UAT follow-up review

Date: 2026-09-24. Source revision before this follow-up: `3eef1e3`. This review supplements the historical gate and preserves its original revision scope.

## User dispositions

The user reported passes for native 200% browser zoom, genuine BFCache restoration, native OS IME, Firefox/WebKit native clipboard and deliberate Dali-only logout (03-02). These are user observations; exact environment versions and detailed traces were not supplied. Actual-provider acceptance is deferred until operator access is available (backlog 999.4). Assistive-technology testing is deferred to backlog 999.3. Pending-access presentation (03-07) remains pending as requested.

## 03-07: pending-access wording review

Resumed on 2026-09-24 at revision `5c7fe7a`. The owner pending-Viewer grant/revoke browser case passed in Chromium, Firefox and WebKit (**3/3**, 31.0s); the grant server suite passed **16/16** (2.61s). The captured UI labels the grant **Pending member sign-in**, acknowledges **Pending access added.**, and explains **Access starts after this person signs in with a verified internal account.** The primary action is **Grant access**. The reviewed flow contains no invitation-sent claim and distinguishes pending from active grants.

This fresh check supports the existing implementation. UAT item 8 remains pending the user's wording review; the historical descriptor-less prohibition and full-gate result are not reclassified by these focused tests. [03-12-CHECKPOINT.md](03-12-CHECKPOINT.md) (current checkpoint and exact commands) records the evidence and preserves approved deferrals.

## 03-11: supplied export analysis

The user-supplied local export parses as a single page snapshot: one page, one surface, five shapes, three connectors, four notes, twelve paragraphs, one image block and two image-adjustment records. The image block declares 460 by 690 pixels and 1,928,265 bytes. Its source reference matches the SHA-256 content hash and byte size of an asset beside the snapshot. The asset directory has three files; only one is directly referenced by an image block. No external HTTP(S) URL was found in the snapshot.

This establishes snapshot structure and availability of the referenced source image. It does not establish a successful re-import, copied-board ownership, selective local-board upload, or preservation of the source IndexedDB content. The user clarified that only export was performed. The supplied content, file path, names, identifiers and images remain outside this public repository.

Evidence at the original export-review revision:

- [import-local.ts](../../../src/boards/import-local.ts) (read-only legacy capture, selected document conversion and referenced-blob manifest).
- [local-board-import.spec.ts](../../../tests/local-board-import.spec.ts) (two-board fixture, one selected destination, source document membership and image bytes unchanged after success, failure and retry).

At that review revision, a production Chromium run passed all 19 local-board import regressions, including success, rollback, retry, partial copying and identity changes. The existing regression compares full legacy stores and catalog before and after copying, and verifies a single private destination owned by the importer. This supports the implementation but does not replace the outstanding user disposition or create a machine-proven GSD enforcement descriptor.

Latest user disposition: the optional browser-local migration workflow is not needed, so item 9 stays skipped by user decision. The user subsequently requested removal of **Copy local boards** and replacement with a file picker and drop zone. Library **Import** now creates a new private canvas from a single exported Dalí archive (.zip), including its editable objects and images. The migration dialog is removed. File import uses the existing staged transaction and leaves browser-local storage untouched. Current implementation and regression evidence is recorded in [quick task 260924-s1x](../../quick/260924-s1x-replace-local-board-copying-with-file-se/260924-s1x-SUMMARY.md) (file import behavior, validation and scope). The superseded migration tests and 19-case result above retain their historical revision scope. The waiver supplies no machine-proven GSD enforcement descriptor.

## 03-12: scoped public-artifact privacy review

Judgment disposition: pass for the reviewed repository content and reachable history.

- Inspected 360 tracked paths and 1,245 reachable historical blobs for host-specific paths, private-key material, common access-token/key formats, known organization-specific terms and non-example identity-provider hosts.
- The five identity-provider host matches were public `developer.okta.com` documentation references, reviewed in context. Email candidates were synthetic example addresses and an upstream font-license attribution.
- The three tracked binary assets are logo/favicon assets. No tracked canvas export, user screenshot, operator configuration or runtime database was identified.
- Configuration surfaces use generic environment-variable names; synthetic authentication fixtures generate secrets for test execution. Ignore rules cover environment files and browser-test output.
- Reviewed content only; no publication was performed. Personal Git author/committer attribution is permitted by the repository policy.

This is a scoped judgment review, not a certification of deployed services, external operator storage, binary image metadata, or every possible secret format. Recheck staged changes and outgoing history before publication, including any future additions. The existing source privacy policy continues to apply.

## Acceptance boundary

[03-UAT.md](03-UAT.md) (current checklist) records six passes, three skips (two deferred follow-ups and one optional-workflow waiver), and one pending item. Historical automated verification remains 99/104 at its recorded revision; it has not been rerun or re-scored as a full phase gate by this review. Phase 3 remains open for item 8.
