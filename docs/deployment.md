# Production deployment

Build the two pinned targets from the committed lockfile:

```sh
docker build --target app -t dali-app:release .
docker build --target web -t dali-web:release .
node scripts/production-smoke.mjs --app-image dali-app:release --web-image dali-web:release
```

The smoke command requires a ready Docker daemon and OpenSSL. It creates uniquely named, owned containers, volumes and a temporary TLS certificate. It exercises static HTTP, signed OIDC with PKCE, secure cookies, forwarding-header spoofing, board/document/image acknowledgments, provider outage, SIGTERM and restart through the actual images. It prints `IMAGE_SMOKE_PASS` only after every check passes, and removes its own fixtures. This synthetic proof does not establish operator storage independence, Kubernetes scheduling or recovery objectives.

## Runtime topology

Run one app container and one web container in the same pod/network namespace. The app binds `127.0.0.1:3000`. The nonroot nginx container receives port `8080` from an operator-controlled HTTPS ingress and serves the SPA; `/api`, `/auth` and `/health` proxy to the loopback app. Route all paths on the same HTTPS origin. The ingress must validate the configured public host, terminate TLS and prevent clients reaching port 8080 directly. Keep the service private to ingress and do not publish backend port 3000.

Set `DALI_TRUST_PROXY=loopback` for this topology. Only the first proxy hop from `127.0.0.1`, `::1` or IPv4-mapped loopback is trusted. The web proxy overwrites protocol with the deployment's fixed HTTPS scheme and overwrites forwarding host/address; it clears `Forwarded`. Authentication uses the explicitly configured origin and callback. Omit proxy trust for direct loopback development; arbitrary proxy-trust values fail startup.

Run the app as UID/GID `1000:1000`, web as `101:101`, with read-only root filesystems, all capabilities dropped and privilege escalation disabled. Provide writable temporary storage at `/tmp` for both containers. Mount the live database directory owned by app UID 1000 with mode 0700; SQLite also needs its adjacent WAL/SHM files. Mount a separately provisioned backup destination with the same ownership. The operator must independently verify storage locking, durable flush, capacity, backup failure-domain independence and the absence of a second writer. Use one app replica and a deployment strategy that prevents overlap against the same database. Production infrastructure and secrets belong in operator-controlled configuration outside this repository.

## External configuration

| Interface | Purpose |
|---|---|
| `NODE_ENV=production` | Enforce HTTPS identity/origin configuration |
| `DALI_ORIGIN` | Canonical HTTPS application origin |
| `DALI_DATABASE_PATH` | Absolute SQLite path in the live writable volume |
| `DALI_SESSION_SECRET` | Secret of at least 32 characters, stable across restarts |
| `DALI_SESSION_TTL_MS` | Positive session lifetime, at most 31 days |
| `DALI_OIDC_ISSUER` | HTTPS issuer discovery location |
| `DALI_OIDC_CLIENT_ID`, `DALI_OIDC_CLIENT_SECRET` | Externally registered confidential client |
| `DALI_OIDC_CALLBACK_URL` | Canonical origin followed by `/auth/callback` |
| `DALI_INTERNAL_CLAIM`, `DALI_INTERNAL_VALUES_JSON` | Internal-membership policy |
| `DALI_INTERNAL_EMAIL_DOMAINS_JSON` | Verified-email domain allowlist |
| `DALI_EMAIL_CASE_FOLD` | Optional explicit `true`/`false`, defaults to false |
| `DALI_ROLE_CLAIM`, `DALI_EDITOR_VALUES_JSON` | Optional editor-role policy |
| `DALI_TRUST_PROXY` | `loopback` for the same-pod TLS topology |
| `DALI_BACKUP_DIRECTORY` | Absolute path in independent backup storage |
| `DALI_BACKUP_INDEPENDENT_STORAGE=true` | Operator assertion after storage validation |
| `DALI_BACKUP_INTERVAL_MS`, `DALI_BACKUP_MAX_AGE_MS`, `DALI_BACKUP_RETENTION_DAYS` | Optional backup policy within validated limits |

Deliver secrets through the platform's secret interface. Never bake identity settings, keys, certificates or operator evidence into images. Test identity providers and test suites are excluded from production compilation and build context. Application startup refuses authentication bypass environment variables.

## Probes and shutdown

Use `/health/live` for liveness and `/health/ready` for startup/readiness, reached via the web port. Liveness is independent of identity-provider and backup availability. Readiness requires configuration, migrations, initialized storage and a working local database query. Backup freshness is a separate authenticated `/api/storage-health` signal and gates durable writes; publication outages retain read/repair access.

Set Kubernetes `terminationGracePeriodSeconds: 60`. SIGTERM immediately fences mutation admission, closes idle connections, drains in-flight requests, stops the backup scheduler and closes SQLite. The application has a 45-second deadline; an exceeded deadline exits nonzero so operators can detect an incomplete graceful drain. Long-lived streams may reach that deadline. Only successful committed acknowledgments should be interpreted as durable writes; clients reconcile interrupted requests through the existing protocol.

## Pinned build provenance

The Dockerfile pins official multi-platform images:

| Stage | Image digest |
|---|---|
| Build | `node:24-bookworm@sha256:64af3819f9275802414d7cdc38c27e9d82bd564dec4d4da87d008255d36c63b4` |
| App | `node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` |
| Web | `nginx:stable-alpine@sha256:985220252f3863977e468f611ef118ebd01421289dd86ee1ae99cb068c3bce2b` |

Before clean dependency installation, verify the configured registry's pinned `better-sqlite3@13.0.3` metadata against the lockfile integrity and official WiseLibs source. The build explicitly approves only the installed pinned `better-sqlite3` and `esbuild` lifecycle scripts, rebuilds the native SQLite binding inside Linux and verifies file-backed WAL/FULL before pruning development packages. npm reports the existing `@blocksuite/icons@2.2.17` engine declaration excludes Node 24; the actual build and image gates must continue to run, and no package upgrade is implied by this packaging work.

References: Fastify server/proxy and shutdown documentation ([https://fastify.dev/docs/latest/Reference/Server/](https://fastify.dev/docs/latest/Reference/Server/)); Node official image ([https://hub.docker.com/_/node](https://hub.docker.com/_/node)); nginx official image ([https://hub.docker.com/_/nginx](https://hub.docker.com/_/nginx)); better-sqlite3 source ([https://github.com/WiseLibs/better-sqlite3](https://github.com/WiseLibs/better-sqlite3)); npm pinned metadata ([https://registry.npmjs.org/better-sqlite3/13.0.3](https://registry.npmjs.org/better-sqlite3/13.0.3)).
