# API Coverage — Configurable OIDC / Okta compatibility

Full coverage of the chosen OIDC identity integration is enumerated below. Opt-outs follow the approved Dali session and operator boundaries. Board REST endpoints are application-owned contracts in [03-PLAN-INDEX.md](03-PLAN-INDEX.md) (route, schema and permission definitions).

| capability | decision | reason |
|---|---|---|
| OIDC discovery and issuer validation | INTEGRATE | Configured trusted issuer with server-side discovery; 03-02. |
| Authorization Code with PKCE S256 | INTEGRATE | Direct entry with single-use state/nonce and retained local target; 03-02. |
| Token endpoint code exchange and ID-token validation | INTEGRATE | Library validates signature/audience/lifetime and browser-bound transaction; 03-02. |
| JWKS retrieval and signing-key selection/rotation | INTEGRATE | Library discovery/JWKS handling and malformed/unknown key tests; 03-02. |
| UserInfo with subject validation | INTEGRATE | Trusted profile/email claims are subject-checked; 03-02 and 03-07. |
| Internal membership and verified-email claim policy | INTEGRATE | Fail-closed operator mapping and one-time pending identity binding; 03-02/07/12. |
| Local persistent session and application logout | INTEGRATE | Opaque server session, configured absolute expiry and explicit signed-out page; D-03/D-04. |
| Refresh token and offline_access | OPT-OUT | D-04 uses an absolute Dali server session and deliberate reauthentication; no downstream provider API needs renewable tokens. |
| Provider RP-initiated/global logout | OPT-OUT | D-03 explicitly requires Dali-only logout and preserving the provider session. |
| Provider front-channel/back-channel logout registration | OPT-OUT | Approved Dali-local session/logout model; provider-wide session lifecycle is outside Phase3's defined contract. |
| Token introspection/revocation API | OPT-OUT | The app validates ID tokens through the OIDC library and stores opaque Dali sessions; it does not maintain delegated resource-API token sessions. |
| Dynamic client registration | OPT-OUT | Confidential application registration is operator-controlled and deliberately outside the public application. |
| Implicit, password and client-credentials sign-in grants | OPT-OUT | Approved member authentication uses interactive Authorization Code plus PKCE; these grants do not implement that member flow. |
| Pushed authorization requests and signed request objects | OPT-OUT | No operator contract requires optional PAR/JAR profiles; the selected standard confidential code/PKCE flow includes state/nonce and fixed redirect validation. |
| MFA, password recovery and authenticator enrollment management | OPT-OUT | The configured provider owns its login experience and policy; Dali consumes successful trusted OIDC authentication. |
| Okta administration, directory provisioning, SCIM and group management | OPT-OUT | AUTH-01 integrates configurable OIDC sign-in. Directory/admin/provisioning changes are outside the approved identity capability and operator boundary. |

Sources: OpenID Foundation, [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) (code flow, claims, UserInfo); Okta, [Authorization Code with PKCE](https://developer.okta.com/docs/guides/implement-grant-type/authcodepkce/main/) (provider-compatible flow); panva, [openid-client](https://github.com/panva/openid-client) (library capability surface). Source selection and exact runtime pins are recorded in [03-RESEARCH.md](03-RESEARCH.md) (primary-source technical research). No new external service capability is implied.

## Multi-source coverage audit

Every in-scope source item has an implementing plan. Coverage here is planning traceability; all runtime evidence remains pending.

| Source | ID | In-scope item | Plan(s) | Status |
|---|---|---|---|---|
| GOAL | Phase3 | Internal member authenticates, finds authorized boards and works under owner-controlled document/image permissions | 02–12 | COVERED |
| REQ | AUTH-01 | Configurable Okta-compatible OIDC sign-in and Dali sign-out | 01, 02, 06, 10, 12 | COVERED |
| REQ | BOARD-01 | Named private creation and authorized reopen from home | 03–06, 08, 10–12 | COVERED |
| REQ | BOARD-02 | Authoritative private/shared and role labels | 03, 06–08, 12 | COVERED |
| REQ | BOARD-03 | Owner internal editor/viewer grants and revoke | 07, 08, 12 | COVERED |
| REQ | BOARD-04 | Editor writes, Viewer reads, unauthorized documents/images denied | 03–12 | COVERED |
| CONTEXT | D-01 | Direct provider entry and target preservation | 02, 06 | COVERED |
| CONTEXT | D-02 | Paused, preserved same-account reauthentication recovery | 10 | COVERED |
| CONTEXT | D-03 | Deliberate Dali-only sign-out | 02, 10 | COVERED |
| CONTEXT | D-04 | Persistent absolute-expiry session | 02 | COVERED |
| CONTEXT | D-05 | Private creator ownership | 03, 08, 11 | COVERED |
| CONTEXT | D-06 | Existing internal search and pending trusted email access | 07 | COVERED |
| CONTEXT | D-07 | Viewer default, explicit Editor | 07 | COVERED |
| CONTEXT | D-08 | Link location alone gives no access | 07 | COVERED |
| CONTEXT | D-09 | Viewer PNG/PDF; writer editable download | 09 | COVERED |
| CONTEXT | D-10 | Writer duplicate, private fresh actor-owned copy | 08 | COVERED |
| CONTEXT | D-11 | Owner/Editor inline and library rename | 08 | COVERED |
| CONTEXT | D-12 | Named owner-only delete and owner grant management | 07, 08 | COVERED |
| CONTEXT | D-13 | Authenticated home and explicit no-fallback denied target | 03, 06 | COVERED |
| CONTEXT | D-14 | Existing cards, recent order, filters and roles | 03 | COVERED |
| CONTEXT | D-15 | Main Menu/File New tab and editable header title | 06, 08 | COVERED |
| CONTEXT | D-16 | Explicit selected local copy, originals retained, account isolation | 05, 10, 11 | COVERED |
| RESEARCH | R-01 | Exact established dependencies, freshness warning, provenance/scripts/native smoke | 01 | COVERED |
| RESEARCH | R-02 | Same-origin Fastify/SQLite, transaction migrations, prepared statements | 01–04 | COVERED |
| RESEARCH | R-03 | OIDC code/PKCE/state/nonce/trusted claims and persistent opaque sessions | 02 | COVERED |
| RESEARCH | R-04 | Stable issuer/subject, trusted pending email binding, real-provider A2 | 02, 07, 12 | COVERED |
| RESEARCH | R-05 | SQL catalog/grants/title authority, exact resource association and policy | 03, 04, 07, 08 | COVERED |
| RESEARCH | R-06 | Yjs merge/diff, bounded binary bodies, transactional session/role checks | 04 | COVERED |
| RESEARCH | R-07 | Public BoardWorkspace/Doc/Meta composition and A1 conformance before migration | 05, 06 | COVERED |
| RESEARCH | R-08 | Reader zero-write hydration and disposal without shared data clearing | 04, 05, 09 | COVERED |
| RESEARCH | R-09 | Generation-bound HTTP sources, no local fallback after denial | 04–06, 10 | COVERED |
| RESEARCH | R-10 | Protected image/thumbnail no-store, current membership, safe blob removal | 03, 04, 09 | COVERED |
| RESEARCH | R-11 | Persistent document-plus-image outbox, same-identity replay and role loss | 10 | COVERED |
| RESEARCH | R-12 | Expected-account stale tabs, BFCache validation, URL/cache cleanup | 06, 10 | COVERED |
| RESEARCH | R-13 | Existing legacy keys; no root upload; validated native ID transform | 06, 11 | COVERED |
| RESEARCH | R-14 | Atomic complete-image selected import/duplicate and idempotent result lookup | 08, 11 | COVERED |
| RESEARCH | R-15 | Native shortcut/paste/drop/Properties/history/export capability checks | 09 | COVERED |
| RESEARCH | R-16 | Four synthetic identities, signed provider, canaries, zero-skips and production bypass rejection | 01, 02, 04–12 | COVERED |
| RESEARCH | R-17 | Separate actual-provider configuration/evidence and uncovered native checks | 12 | COVERED |
| RESEARCH | R-18 | ASVS1 STRIDE register with high-threat blocking | All | COVERED |
| UI | 39 criteria | All approved UI state predicates lifted verbatim and mapped to executing tests | 02, 03, 06–12 | COVERED |
| EDGE | 24 predicates | All surfaced requirement edges lifted verbatim and mapped to tasks | 02–04, 06–08, 10–11 | COVERED |

Excluded by approved allocation: Phase4 restart/recovery/backup/deployment acceptance; Phase5 live transport/presence/reconnect/active-connection revocation and 20-user validation; later facilitation/templates/diagrams/Gantt; deferred MCP and Plane; excluded ClickUp imports. No deferred item is implemented by these plans.

## Prohibition recall audit

Each requirement received recall followed by precision filtering. AUTH-01 kept deliberate application-only logout; BOARD-01 kept explicit selected copying with original preservation; BOARD-03 kept honest pending-access communication; the public privacy boundary applies across all five. BOARD-02/BOARD-04 candidates concerning routine sorting, correctness, IDOR, CSRF, payload limits or cryptographic trust were referred to edge predicates and the ASVS/security lanes rather than duplicated as bespoke prohibitions.

The four retained items are serializer-projected, descriptor-less and flagged-unverified in plans 02, 07, 11 and 12. No check descriptor or execution proof was invented. The executor and final verifier must preserve that status until genuine evidence or judgment resolves it; autonomous planning does not dismiss them.
