---
phase: "03"
slug: "okta-and-board-access"
status: verified
threats_open: 0
threats_total: 31
threats_closed: 31
asvs_level: 1
block_on: high
created: "2026-09-16"
source_head: 8320dd1eae58b28444237f464b8cb7a1d4d19156
style_delta_head: f2769dc
documentation_head: 23db4248aebcfdb98d6eb75ac5c24bfd83ec8d2b
---

# Phase 3 — Security

The independent typed security auditor verified all 31 declared mitigation boundaries at the pinned source revision. This ASVS level 1 result establishes mitigation presence. Full browser execution, actual-provider acceptance and native observations have separate gates in `03-12-CHECKPOINT.md` and `docs/access-acceptance.md`.

## Trust Boundaries

| Boundary | Description | Data crossing |
|---|---|---|
| Identity provider to server | Validated OIDC exchange and internal membership policy | Signed tokens, verified claims, issuer/subject |
| Browser to authenticated server | Session, origin and expected-account checks | Board operations, identifiers, credentials in cookies |
| Board resource boundary | Current role and composite resource authorization | Documents, metadata, images, thumbnails, exports |
| Client account lifecycle | Generation isolation and durable recovery scope | Pending documents/images, cached native models |
| Legacy import to account storage | Explicit selection and atomic staging | Synthetic tested local documents/images; originals retained |
| Operator configuration to public project | Generic configuration interfaces and private acceptance evidence | Operator-controlled secrets and mappings stay external |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
|---|---|---|---|---|---|---|
| T-03-SC | Tampering | dependency installation | high | mitigate | `package.json:35`; `package-lock.json:3217`; `server/preflight.test.ts:4,18,26`: exact pins, locked registry/SHA-512, actual ESM and SQLite transaction smoke; 58 cached added tarballs independently matched integrity. | CLOSED |
| T-03-01 | Spoofing | synthetic identity harness | high | mitigate | `server/app.ts:50,69`; `tests/access-fixtures.ts:18,36`; `server/auth/oidc.test.ts:161`: separate signed provider, ordinary login, production bypass rejection. | CLOSED |
| T-03-02 | Spoofing | OIDC callback | high | mitigate | `server/auth/oidc.ts:22,29,41,46`; `server/auth/oidc.test.ts:64`: discovery/signatures, state/nonce/PKCE, browser-bound single-use transaction and signed negative cases. | CLOSED |
| T-03-03 | Elevation of privilege | session and identity policy | high | mitigate | `server/auth/identity-policy.ts:4`; `server/auth/oidc.ts:55,63`; `server/auth/session-store.ts:8,29,42`: issuer/subject, verified internal identity, session rotation and absolute expiry. | CLOSED |
| T-03-04 | Tampering | cookie-authenticated mutations | high | mitigate | `server/auth/session-store.ts:49,55`; `server/auth/oidc.ts:71`; `server/auth/oidc.test.ts:139`: expected member, exact Origin, request marker and logout CSRF denials. | CLOSED |
| T-03-05 | Information disclosure | library and thumbnail catalog | high | mitigate | `server/boards/routes.ts:117,132`; `server/app.ts:52`; `src/boards/BoardLibrary.tsx:14`; `tests/access-boundaries.spec.ts:119,153`: authorized catalog/preview, no-store, independent canary rereads. | CLOSED |
| T-03-06 | Elevation of privilege | board creation and descriptors | high | mitigate | `server/boards/routes.ts:128,161,170,178`: authorized descriptors, server-generated board/document identities and authenticated owner in transaction. | CLOSED |
| T-03-07 | Information disclosure | document/subdocument/image keys | high | mitigate | `server/boards/documents.ts:17`; `server/boards/blobs.ts:85,100`; `tests/access-boundaries.spec.ts:175`: composite board/resource bindings and foreign-key denials. | CLOSED |
| T-03-08 | Tampering | synchronization writes | high | mitigate | `server/boards/documents.ts:74`; `server/boards/blobs.ts:120`: transactional current member/session/write checks, authoritative Yjs merge and atomic save. | CLOSED |
| T-03-09 | Denial of service | binary payload handlers | high | mitigate | `server/boards/documents.ts:8,66,79`; `server/boards/blobs.ts:12,23`; `server/boards/imports.ts:48`: bounded bytes/vectors/objects/images, controlled decoding and raster validation. | CLOSED |
| T-03-10 | Information disclosure | workspace root and lifecycle | high | mitigate | `src/canvas/account/board-workspace.ts:46,84`; `board-meta.ts:11`; `tests/account-workspace.spec.ts:130,138`: account/board/generation binding, one metadata page, foreign subdoc rejection. | CLOSED |
| T-03-11 | Tampering | reader hydration/disposal | high | mitigate | `src/canvas/account/board-workspace.ts:105,130,169`; `board-doc.ts:27`; `tests/account-workspace.spec.ts:97`: authoritative hydration, pre-render readonly guard, writable-only sync, zero-write disposal oracle. | CLOSED |
| T-03-12 | Information disclosure | entry and delayed runtime | high | mitigate | `src/App.tsx:59,72,77`; `src/canvas/runtime.ts:77`: authorization before mount and generation-bound delayed work/disposal. | CLOSED |
| T-03-13 | Tampering | new tab and legacy cleanup | high | mitigate | `src/header/Header.tsx:55`; `src/boards/preferences.ts:73`; `operations.ts:144`; `src/canvas/legacy-runtime.ts:27,66`: unique new-tab operation and account/legacy deletion separation. | CLOSED |
| T-03-14 | Elevation of privilege | grant creation/activation | high | mitigate | `server/auth/identity-policy.ts:4`; `server/boards/grants.ts:9,21`; `server/auth/oidc.ts:55`: trusted verified email, issuer-scoped ambiguity/history checks and one-time stable-member activation. | CLOSED |
| T-03-15 | Tampering | stale grant mutations | high | mitigate | `server/boards/grants.ts:56,66,75,95`: guarded mutation, commit-time owner/session/member check, board/grant revisions and operation fingerprints. | CLOSED |
| T-03-16 | Information disclosure | member search and access UI | high | mitigate | `server/boards/grants.ts:44,52`: owner-only search/grant listing, established same-issuer members. | CLOSED |
| T-03-17 | Elevation of privilege | duplicate/rename/delete | high | mitigate | `server/boards/routes.ts:15,45`; `server/boards/actions.ts:23,35,61`: shared capability matrix, commit-time action/source checks and resource-authorized receipts. | CLOSED |
| T-03-18 | Tampering | duplicate/import document identity | high | mitigate | `src/boards/operations.ts:37,99`; `server/boards/imports.ts:56,66,68`: regenerated native identities, current authorized source, validated documents and complete image manifest. | CLOSED |
| T-03-19 | Tampering | destructive UI or timeout retry | medium | mitigate | `src/boards/BoardActionDialog.tsx:14,21,36`; `operations.ts:65,89`: safe focus, named target and stable operation reconciliation. | CLOSED |
| T-03-20 | Tampering | viewer native inputs | high | mitigate | `src/canvas/account/mutation-guard.ts:7,20,41`; `src/canvas/blocksuite-editor.ts:34`; `tests/account-workspace.spec.ts:123`; `tests/board-roles.spec.ts:101,163`: current-scope native final-write guard and unchanged native/local-model oracles. | CLOSED |
| T-03-21 | Elevation of privilege | editable export alternate entrypoints | high | mitigate | `src/canvas/export-board.ts:140,165`; `src/header/ExportDialog.tsx:40`; `Header.tsx:134`; `server/boards/actions.ts:51`: central current-scope export policy and final download/server rechecks. | CLOSED |
| T-03-22 | Information disclosure | cross-account caches/outbox | high | mitigate | `src/canvas/account/outbox.ts:4,28`; `src/auth/session.ts:61`; `blob-source.ts:71`; `tests/session-recovery.spec.ts:101`: exact account/board recovery namespace, quarantine and URL/cache cleanup. | CLOSED |
| T-03-23 | Elevation of privilege | pending replay | high | mitigate | `src/canvas/account/outbox.ts:61`; `server/boards/documents.ts:74`; `blobs.ts:120`: freshly authorized same-account writable replay, images first, acknowledged commits only. | CLOSED |
| T-03-24 | Tampering | stale tab/BFCache/in-flight response | high | mitigate | `src/auth/session.ts:107,132`; `src/canvas/account/doc-source.ts:24`; `blob-source.ts:23`; `tests/session-recovery.spec.ts:119,180,213`: revalidation, cross-tab/persisted-pageshow barrier, expected member and stale-response rejection. | CLOSED |
| T-03-25 | Information disclosure | unselected/foreign local inventory | high | mitigate | `src/boards/import-local.ts:16,33`; `LocalBoardCopyDialog.tsx:35,55`; `tests/local-board-import.spec.ts:223`: legacy-only inventory, explicit eligible selection and account-namespace exclusion. | CLOSED |
| T-03-26 | Tampering | partial/duplicate import publication | high | mitigate | `server/boards/imports.ts:25,82,94,110`; `tests/access-boundaries.spec.ts:31`: actor-scoped idempotent staging, complete hashed manifest and atomic publication; nine-table rejected-write comparison. | CLOSED |
| T-03-27 | Tampering | local originals and account change | high | mitigate | `src/canvas/workspace.ts:275`; `src/boards/import-local.ts:33,94`; `LocalBoardCopyDialog.tsx:46`; `tests/local-board-import.spec.ts:137,278`: readonly existing local DB, isolated copy, identity stop and original-byte equality. | CLOSED |
| T-03-28 | Information disclosure | public logs/artifacts | high | mitigate | `server/app.ts:51,53`; `tests/access-fixtures.ts:18`; `server/auth/oidc.test.ts:64`: logging disabled, generic errors, synthetic fixtures and redaction; bounded 111 changed-file/commit-message privacy review. | CLOSED |
| T-03-29 | Spoofing | real-provider acceptance claims | high | mitigate | `docs/access-acceptance.md:3,32,50,78`; `tests/accessibility-access.spec.ts:89,99`: actual-provider not-run status, operator oracles, genuine-history observation and separate native/constructed evidence. | CLOSED |
| T-03-30 | Elevation of privilege | uncovered alternate entrypoints | high | mitigate | `tests/access-boundaries.spec.ts:101,132,191`; `playwright.config.ts:6,18`; `03-12-CHECKPOINT.md:111`: 189 independent signed denial cases, 30 application route pairs, 39 UI predicates and all five projects; full execution still pending. | CLOSED |

All threats have mitigate disposition; 30 are high severity and one is medium. There are zero blocking or non-blocking open threats. Evidence line numbers refer to the pinned source; abbreviated filenames continue the same directory from the preceding reference.

## Accepted Risks Log

No accepted risks.

## Summary Threat Flags

The explicit thumbnail PUT endpoint flag in `03-06-SUMMARY.md` maps to T-03-05/07/08/09. `server/boards/routes.ts:140` applies bounded payload, raster validation, request guard, board/account binding and transactional write-capability recheck. No unregistered flags remain.

## Evidence Boundaries

- The auditor independently matched all 58 added package tarballs available in the local cache to locked SHA-512 integrity and inspected lifecycle declarations/repository metadata. None declared preinstall/install/postinstall; prepare declarations were inspected separately. The original raw pre-install registry/provenance transcript was not located. Current pins, integrity, declarations and native-load test coverage are verified; historical pre-install timing is not reconstructed.
- This auditor ran no tests, builds, browser sessions or listeners. Test-oracle existence is distinct from execution. The final executor owns the full browser gate; its newly identified development proxy fixture correction is subject to separate delta review.
- Actual-provider A1–A9, native OS IME, assistive-technology speech, native 200% zoom and genuine BFCache restoration remain pending. T-03-29 closes the truthful evidence-separation control, not those acceptance steps.
- The privacy inspection was bounded to 111 phase-changed tracked files and phase commit messages using examined private-data patterns. It is not an exhaustive historical secret audit. No implementation changes were made by the auditor. Later changes require a bounded audit delta.

## Security Audit Trail

| Audit date | Threats total | Closed | Open | Run by |
|---|---|---|---|---|
| 2026-09-16 | 31 | 31 | 0 | gsd-security-auditor; orchestrator persisted the returned verdict |

## Sign-Off

- [x] Every threat has a disposition and implementation evidence.
- [x] Accepted risks log records none.
- [x] `threats_open: 0` confirmed at ASVS level 1, high blocking threshold.
- [x] `status: verified` set for this security audit.

**Security result:** verified 2026-09-16. Phase acceptance remains in progress.

## Post-audit fixture delta

The independent code reviewer inspected test-only commit `1a55d14`, retaining the complete 92-file scope, and reported no findings. Development HMR WebSocket forwarding preserves protected routes and strict identity-context error collection. The exact handled stale-source console cancellation allowance applies only after injected revocation; pre-denial checks, no-pageerror assertions and protected UI/blob/canary-removal predicates remain. Production mitigation code is unchanged from `033ecc0`. The reported 16 focused development passes are attributed to the executor; the complete browser matrix remains pending. This delta does not change the 31 source-mitigation dispositions.

## UI and navigation security delta

The typed security auditor independently checked the full affected source through `8320dd1` and commits `995ec47`, `7c8982c`, `b4877ce` and `8320dd1`. All 31 dispositions remain CLOSED, with zero blocking or non-blocking open threats, no accepted risks and no new unregistered flags. Server authorization, session state, canvas scope/runtime, operation services, dependencies and five-project selection are unchanged from the original audit.

| Threat | Current boundary evidence | Delta result |
|---|---|---|
| T-03-01 | `tests/access-fixtures.ts:21,40,72`; `server/app.ts:50` | Ordinary signed login retained; test-only asset proxy restricts upgrades to development HMR. |
| T-03-03 | `src/auth/AuthBoundary.tsx:16,27,51` | Validated session and absolute expiry precede protected content; focus adds no identity bypass. |
| T-03-12 | `src/App.tsx:63,76,77,81` | Expected account and generation authorization still precede runtime mount; denial and cleanup remove it. |
| T-03-13 | `src/header/Header.tsx:41,54,67`; `src/boards/BoardLibrary.tsx:85` | Reserved tab uses safe textContent, cleared opener and distinct operation; completion is current-account/generation bound. Library opens only the acknowledged authorized destination. |
| T-03-19 | `src/boards/ShareBoardDialog.tsx:68,73,91,117,159`; `BoardActionDialog.tsx:14,21,37` | Original operation payload/ID survives uncertainty and removed rows; safe focus and named confirmations retained. |
| T-03-24 | `src/boards/ShareBoardDialog.tsx:24,75`; `src/auth/session.ts:107,132` | Terminal receipt denial clears stale owner state without mutation retry; existing restore/generation barriers retained. |
| T-03-28 | `tests/access-fixtures.ts:23,69,79` | Synthetic fixtures, teardown and strict error collection retained; bounded 20-file added-line privacy scan found no examined private-data patterns. |
| T-03-30 | `tests/board-sharing.spec.ts:76,108,128`; `board-access.spec.ts:26`; `board-library.spec.ts:76` | Exact original receipt, one mutation, current authorization, source isolation and recovery remain observable; 189-denial matrix and 30 application routes unchanged. |

The remaining 23 threat implementations are unchanged and retain the source evidence above. No tests, builds, browsers or listeners were run by the auditor. The final full matrix and actual-provider/native acceptance remain separate gates. Historical raw pre-install provenance timing remains unverified; dependency files and the earlier 58-tarball integrity result are unchanged.

Subsequent commit `f2769dc` changes only scoped styling and its measured test in `src/index.css` and `tests/accessibility-access.spec.ts`. Independent code and UI reviews inspected the full delta and found no open findings. It changes no identity, permission, operation, recovery or network logic; the 31 mitigation dispositions remain applicable.
