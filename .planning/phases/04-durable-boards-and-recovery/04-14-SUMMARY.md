---
phase: 04-durable-boards-and-recovery
plan: "14"
subsystem: infra
tags: [kubernetes, kustomize, sqlite, tls, network-policy, deployment]
requires:
  - phase: 04-13
    provides: Tested production app/web images and signed TLS/OIDC restart smoke
provides:
  - Restricted single-writer Kustomize base with persistent live and backup volumes
  - Generic TLS ingress and explicit ingress/DNS/OIDC network bindings
  - Static deployment assertions and explicit disposable-cluster persistence smoke command
  - Compatible release and maintenance runbook
affects: [04-15, 04-16]
tech-stack:
  added: []
  patterns: [JSON-syntax YAML, Recreate single writer, explicit fresh namespace, cold HTTPS verification]
key-files:
  created: [deploy/kubernetes/base/kustomization.yaml, deploy/kubernetes/base/deployment.yaml, deploy/kubernetes/base/service.yaml, deploy/kubernetes/base/storage.yaml, deploy/kubernetes/base/network-policy.yaml, deploy/kubernetes/overlays/example/kustomization.yaml, deploy/kubernetes/overlays/example/ingress.yaml, scripts/deployment-smoke.mjs]
  modified: [docs/deployment.md]
key-decisions:
  - Use app exec probes because the production listener binds loopback; web readiness traverses the proxy.
  - Require provisioned UID-1000 mode-0700 volume roots and verified CSI/backup semantics without a privileged ownership-repair container.
  - Retain fresh smoke namespaces and PVCs for operator inspection; never infer a cluster context or adopt existing resources.
requirements-covered: [OPS-01, OPS-02]
requirements-completed: []
coverage:
  - id: kubernetes-static
    description: Portable restricted single-writer manifests with TLS and network boundaries
    requirement: OPS-01
    verification:
      - kind: other
        ref: kubectl kustomize deploy/kubernetes/base
        status: pass
      - kind: other
        ref: node scripts/deployment-smoke.mjs --check-manifests
        status: pass
      - kind: unit
        ref: node --test-reporter=tap scripts/deployment-smoke.mjs --self-test
        status: pass
    human_judgment: false
  - id: kubernetes-runtime
    description: Actual selected-cluster TLS/OIDC and persistent pod-replacement acceptance
    requirement: OPS-01
    verification:
      - kind: e2e
        ref: scripts/deployment-smoke.mjs runtime mode with explicitly selected disposable context
        status: unknown
    human_judgment: true
    rationale: No Kubernetes contexts are configured; independent storage and synthetic platform prerequisites remain external.
  - id: maintenance-envelope
    description: Operator-reviewed backup, single-writer upgrade, cold access and maintenance timing
    requirement: OPS-02
    verification: []
    human_judgment: true
    rationale: Runbook and harness are delivered; actual representative platform timing, CSI semantics and storage-loss recovery require plan 04-15.
actuals:
  tokens: 12341
  tasks: 2
  commits: 3
plan_head_before: 3491591cad4be868dec29cf6bc5448ab8a490f39
duration: 15min
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 14: Kubernetes Deployment Package Summary

**A restricted one-writer Kustomize package, TLS/network boundaries and an explicit disposable-cluster smoke command now separate static configuration proof from real persistent-volume restart acceptance.**

## Task commits

| Task | Commit | Outcome |
|---|---|---|
| 04-14-01 | `219970e` | Recreate app/web Deployment, private Service, separate RWOP PVCs and storage/probe contract |
| 04-14-02 RED | `c3be9c4` | Intentional multiple-writer rejection assertion with validated RED evidence |
| 04-14-02 GREEN | `fb6a583` | TLS ingress, network policy, executable static/runtime smoke and maintenance guide |

Three commits measured from the persisted plan ledger before metadata commits. Actual token estimate is the realized committed diff character count divided by four, rounded up. Both task artifact/done conditions and every exact automated command completed; real deployment and operator acceptance remain pending below.

## Verification evidence

- Exact `kubectl kustomize deploy/kubernetes/base`: passed. The base includes one Recreate Deployment, ClusterIP Service, separate persistent claims and network policy.
- Exact `node scripts/deployment-smoke.mjs --check-manifests`: **MANIFEST_CHECK_PASS (static configuration only)**. Both base and example overlay render; structured resources and example JSON patches satisfy local assertions.
- `node --test-reporter=tap scripts/deployment-smoke.mjs --self-test`: **11 passed, 0 failed, 0 skipped**. Includes valid manifests and rejection of multiple writers, NodePort exposure, missing persistent mount, missing probe, missing TLS, unrestricted egress, privileged container, absent context, default context and nonsynthetic fixture.
- `npm run typecheck && npm run typecheck:server`: passed before each task/RED/GREEN commit; final run passed.
- Existing actual-image `node scripts/production-smoke.mjs --app-image dali-phase4-app:acceptance --web-image dali-phase4-web:acceptance`: **IMAGE_SMOKE_PASS**. This retains the earlier actual production-container TLS/OIDC, durable content and restart scope.
- `node --check scripts/deployment-smoke.mjs`: passed. Direct invocations without context and with context `default` failed before cluster operations, with no acceptance marker.
- Read-only `kubectl config get-contexts -o name`: returned no configured contexts on both checks. No cluster resources were created, changed or deleted.
- Staged privacy review and diff checks passed. User-owned README, package metadata, logos/assets, legal review, install script and milestone lock were preserved.

## Interfaces and implementation

The base runs app UID/GID 1000 and web UID/GID 101 with read-only roots, dropped capabilities, no privilege escalation, RuntimeDefault seccomp, no service token, bounded per-container temporary mounts, resources and startup/readiness/liveness probes. App probes execute against loopback; web readiness uses the actual proxy. Grace is 60 seconds. Provisioner ownership and mode are an explicit prerequisite, avoiding privileged repair containers.

The JSON-syntax YAML files are accepted by Kustomize and parsed without installing a YAML dependency. The example overlay demonstrates image/storage/resource replacements and synthetic TLS references. The network policy is fail-closed until operator-supplied ingress, DNS and OIDC bindings apply. It requires an enforcing CNI and nginx-compatible ingress or an explicitly verified private equivalent.

Runtime smoke requires explicit context, fresh `dali-smoke-*` namespace, built images and external synthetic fixture declarations. Atomic namespace creation prevents adoption races. The script supplies context on every Kubernetes command, creates generic resources with private fixture settings over stdin, waits real probes, signs in through OIDC, commits synthetic board/document/image data, terminates the old writer before replacement and compares pod/PVC/PV identities. Fresh login and HTTPS reads compare exact host-retained bytes. Success prints `DEPLOYMENT_SMOKE_PASS` only after all those gates. Owned namespaces/PVCs remain for inspection and explicitly selected cleanup. The runtime branch has not been executed against a cluster in this plan.

The release guide requires verified selected backup, capacity/schema review, closed ingress, drain/fencing, compatible single-writer deployment, cold content/access checks and reopening within a separately measured 24-hour maintenance window. Destructive real storage/schema actions remain explicit operator checkpoints.

## TDD Gate Compliance

The targeted RED assertion expected the validator to throw for two replicas and observed no exception. An initial reporter format was unreadable by the GSD checker; rerunning the same assertion with TAP produced one selected failing test and **RED_EVIDENCE_OK**. Sanitized evidence is in `04-14-RED.json`. RED commit precedes task 2 GREEN. Final suite has eleven passing cases. Task 1 was configuration-only; global workflow TDD mode remained disabled and no phase-level feature-before-test gate applied.

## Deviations from Plan

**[Rule 2 — Required integration]** Task 2 also updates the already-owned base kustomization to include its network policy; otherwise rendering would omit the required boundary. No architecture or dependency change was introduced.

The missing cluster prerequisite is preserved as an acceptance boundary rather than a simulated runtime result. The exact planned static commands ran; the actual deployment gate is ready for the operator-selected environment and plan 04-15.

## Remaining acceptance and user setup

Actual Kubernetes deployment smoke remains pending: no explicitly selected disposable context or verified independent storage fixture is configured. This is tracked as open entry 18 in `.planning/WINDOWS.md`. Supply the disposable context, supported CSI classes with correct filesystem semantics/ownership, independent backup destination, enforcing CNI, TLS ingress, synthetic signed issuer and private fixture contract documented in `docs/deployment.md` before plan 04-15 runtime acceptance.

Rendering and local assertions do not establish API admission, CNI enforcement, controller redirect/host policy, PVC ownership or survival, storage independence, capacity, RPO/RTO, or 24-hour maintenance completion. OPS-01/OPS-02 acceptance remains unchanged. All new network/storage surfaces are within the plan threat model; threat closure still requires actual platform validation.

## Known Stubs

None in delivered code. Synthetic example image/class/host values are explicit operator configuration interfaces, not deployed-environment claims. No required static verification was skipped.

## Next Plan Readiness

Continue dependency-ready plan 04-07. Plan 04-15 must enforce the real deployment gate and storage prerequisites before its representative recovery drill. This summary closes the local package and executable-harness tasks only.

## Self-Check: PASSED

All nine declared deliverables and RED evidence exist. Commits `219970e`, `c3be9c4` and `fb6a583` exist. No tracked files were deleted by these commits. The runtime gate remains explicitly unknown rather than passing.
