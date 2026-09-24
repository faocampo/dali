# Identity and board-access acceptance

Actual-provider status: **not run / human_needed**. Synthetic protocol and browser results are recorded separately in the Phase 3 checkpoint. An operator supplies the registration, assignments and trusted claim policy in a private environment. Configuration values, real identities, board identifiers, screenshots, cookies and protocol traces remain outside this repository. Public reporting contains only accepted, failed step, or not run.

## Server configuration

The running server reads these names through [server/app.ts](../server/app.ts) (configuration validation and service entry point). Supply them through operator-managed infrastructure, never frontend variables or committed files.

| Name | Operator decision / validation |
| --- | --- |
| `DALI_ORIGIN` | Canonical application HTTPS origin, with no path, credentials, query or fragment. |
| `DALI_DATABASE_PATH` | Private server-side SQLite location with the intended access controls. |
| `DALI_SESSION_SECRET` | Secret of at least 32 characters, held in the operator secret store. |
| `DALI_SESSION_TTL_MS` | Absolute positive integer session lifetime in milliseconds, at most 31 days. Reads do not renew it. |
| `DALI_OIDC_ISSUER` | Exact trusted HTTPS issuer whose discovery and signed tokens the operator validates. |
| `DALI_OIDC_CLIENT_ID` | Registered confidential web application's client identifier. |
| `DALI_OIDC_CLIENT_SECRET` | Its private client secret. |
| `DALI_OIDC_CALLBACK_URL` | Fixed callback at the application origin plus `/auth/callback`, registered exactly at the provider. |
| `DALI_INTERNAL_CLAIM` | Trusted membership claim emitted by the provider; its provenance and assignment semantics require operator acceptance. |
| `DALI_INTERNAL_VALUES_JSON` | Nonempty JSON array of trusted membership values admitted by policy. |
| `DALI_INTERNAL_EMAIL_DOMAINS_JSON` | Nonempty JSON array of permitted internal email domains. |
| `DALI_EMAIL_CASE_FOLD` | Optional `true` or `false`; defaults to `false`. Enable only after verifying provider-wide local-part uniqueness under case folding. |

Production requires HTTPS. Configure the confidential web application for authorization code with PKCE and scopes `openid profile email`, discovery, JWKS and subject-checked UserInfo. Assign two dedicated test members and retain one denied identity. Validate the exact issuer/subject as stable identity, the internal-membership claim, verified email and the directory's email uniqueness/reassignment rules. Domain normalization preserves local-part case and aliases by default. Ambiguous or unverified email must not activate pending access. The operator owns these provider settings and their private evidence.

The agent runs `npm run server:build`, starts the compiled service using the privately supplied environment, and checks the configured application. Infrastructure must serve the production frontend and route `/auth/*` and `/api/*` to the trusted service on the same public origin. The application entry defaults to loopback port 3000 and accepts `PORT` as an infrastructure setting. This checklist does not establish deployment, backup or multi-user collaboration readiness.

## Actual-provider procedure

The agent executes reachable automation after private setup. The operator performs provider administration, interactive MFA and the few native observations unavailable to automation. Keep detailed evidence in the operator-controlled acceptance record.

| Step | Action | Observable acceptance oracle |
| --- | --- | --- |
| A1 | Sign in as assigned member A; create a board with synthetic text and a synthetic image. | The stable account opens its library. New board is private and A is Owner. Denied identity establishes no admitted session. |
| A2 | Before member B's first Dali sign-in, A grants B's trusted internal email without changing Access. | Pending member sign-in and Viewer appear. Wrong-domain, unverified or ambiguous email cannot gain effective access. |
| A3 | B completes actual provider sign-in, then signs in again. | Pending access activates once for B's validated issuer/subject; repeated sign-in creates no duplicate grant. Verify directory/email trust semantics privately before marking A2 accepted. |
| A4 | B opens the granted board; A explicitly selects Editor. | Initially Viewer sees the canary and may export PNG/PDF, while mutations and editable export deny. After current authorization refresh, Editor can edit and rename. |
| A5 | A revokes B; B retries direct board/document/image requests and any pending operation. | Requests deny without revealing canary bytes or changing A's authoritative content, metadata, grants or images. A pasted link grants no access. |
| A6 | Sign in from an authorized board deep link, then try an unauthorized or absent target. | Authorized target survives sign-in. Other targets show the generic denied state and return-to-library action without mounting protected content. |
| A7 | Fully close and restart the test browser before absolute expiry. | Session persists with the same account and absolute expiry. At expiry, protected requests reject; no rolling lifetime is inferred. |
| A8 | Make pending synthetic text/image changes, trigger expiry, then sign back in with the same account. Repeat with a different account and with revoked/write-downgraded access. | Editing pauses and preservation precedes redirect. Same-account fresh write authorization replays image bytes before referencing text/document updates exactly once. Other identity or lost write access retains isolated pending work and sends no replay. |
| A9 | Choose Account → Sign out of Dalí, reload, then deliberately choose Sign in again. | Pending work is preserved first; `POST /api/logout` destroys the Dali session. Signed-out page remains stable until the deliberate action. The provider's session is retained. |

## Restoring an editable recovery archive

An editable recovery archive can be restored through Main Menu → File → Import board while an authorized writable board is open. Select the downloaded `.bs.zip`, confirm **Import private copy**, and use **Open imported board** after publication succeeds. The import creates a new private account board with fresh identities and complete referenced images; the open source board remains available. A failed item retains its retry; an uncertain response offers **Check import again** to reconcile the existing attempt. Keep recovery archives and their contents in the operator-controlled evidence store.

## Native observations remaining

Automated viewport, DOM focus, keyboard, composition-event routing and contrast checks have separate executable oracles. Record only these additional observations where the automation environment cannot provide them:

- Native browser 200% zoom: sharing and recovery dialogs keep the focused row and action reachable with vertical scrolling, and the library/header have no horizontal page overflow. A 490px viewport or CSS scaling does not establish this observation.
- Native OS IME: compose actual text in board-name and member-search fields; composition Enter does not rename, grant or resume paused editing. During recovery, pending native canvas text remains protected.
- Assistive-technology speech: dialog names, connected errors, progress and the acknowledged resumed-editing announcement are spoken at the correct time. Keyboard focus is contained and returns after successful authorization.
- Native Firefox/WebKit clipboard: copy and paste native text, images and mind-map branches as Editor and Viewer, including delayed completion after access loss. Confirm permitted content fidelity and denied native/backend mutations; automated payload routing has separate evidence.
- BFCache: actual history navigation is attempted in the browser suite. If the engine performs an ordinary reload instead of persisted restoration, retain that precise evidence gap; constructed `pageshow` coverage remains separately identified.

## Automated acceptance commands

For local manual role checks, open **Shared role test** using the matching synthetic account. Its Viewer grant is read-only; boards created by that same account are owned by it. See [local role testing](local-role-testing.md) (account roles, sample persistence and retest steps).

Run the two focused cases first:

```sh
npm run typecheck
npm exec playwright test -- tests/access-boundaries.spec.ts tests/accessibility-access.spec.ts --project=prod --grep '@03-12-smoke'
```

The blocking gate is:

```sh
npm run typecheck && npm run typecheck:server && npm test && npm run test:server && npm run build && npm run test:access && npm run test:browser
```

`test:browser` includes dev Chromium, production Chromium, production Firefox, production WebKit and the access project. The account-workspace conformance harness is intentionally dev-only. Record exact selected/pass/fail/skip counts and timings; zero selection, required skips, runtime errors, canary disclosure or changed state after denial block acceptance. Keep the browser/build slot exclusive and use fresh synthetic fixture services.

The final route and UI evidence references [access-boundaries.spec.ts](../tests/access-boundaries.spec.ts) (independent signed role/resource and transaction checks), [accessibility-access.spec.ts](../tests/accessibility-access.spec.ts) (measured interface and real-history navigation), and [03-PLAN-INDEX.md](../.planning/phases/03-okta-and-board-access/03-PLAN-INDEX.md) (requirement, decision and 39 UI-predicate mapping). Actual results belong to the checkpoint and test reports. Descriptor-less prohibitions remain **flagged-unverified** where no executable check is wired; planned assertions do not establish deterministic verification.

## Acceptance record

| Evidence class | Status |
| --- | --- |
| Actual confidential client registration and assignments | Not run / operator setup required |
| Actual membership, issuer/subject and verified-email semantics | Not run / human_needed |
| Actual-provider A1–A9 workflow | Not run / human_needed |
| Native zoom, OS IME, assistive-technology speech and Firefox/WebKit clipboard | Not observed in automation; narrow checks above |
| Synthetic application/protocol/regression gate | See Phase 3 checkpoint for measured results |

Public outcome format: `Actual provider: accepted` or `Actual provider: failed at A<n> — generic failure`, plus the statuses of the specifically outstanding native checks. Never include configuration values or private evidence in this public record.

## Ownership and system Viewer acceptance

A system Viewer can read shared boards but cannot create fresh boards or import local/archive boards. A member who already owns a board retains Owner capabilities on that board, even when the member's system role is Viewer. The library and account menu display this effective board role. Duplicating a board requires effective Editor or Owner access, produces a private copy owned by the copier, and preserves the source. Grant revocation or ownership loss before commit denies the copy.

Actual-provider acceptance is deferred until operator access is available; it remains separately tracked in backlog 999.4. Screen-reader speech and interaction acceptance is tracked in backlog 999.3. See [Phase 3 UAT](../.planning/phases/03-okta-and-board-access/03-UAT.md) (current user dispositions and remaining checks).
