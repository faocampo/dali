# Phase 4: Durable Boards and Recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents. Decisions are captured in 04-CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 04-durable-boards-and-recovery
**Areas discussed:** Save status and failures; Interrupted work; Deployment expectations; Backups and restoration.

The user selected all four areas for discussion and explicitly approved finalizing the context after answering each area.

## Save status and failures

### How should save failures or prolonged delays appear?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Persistent compact banner: explain the problem and offer recovery actions until saving succeeds. Recommended. |  |
| 2 | Status beside the title: show the issue there, with details on click. | Yes |
| 3 | Blocking dialog: require acknowledgment before continuing. |  |

**User's choice:** Status beside the title: show the issue there, with details on click.

### How should retrying work?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Automatic retry plus manual controls: retry in the background; the details offer Retry now and Download recovery copy. Recommended. | Yes |
| 2 | Manual retry: wait for the user to select Retry saving; also offer Download recovery copy. |  |

**User's choice:** Automatic retry plus manual controls: retry in the background; the details offer Retry now and Download recovery copy. The recovery copy includes pending changes and images available in that browser.

### If the board content saves but an image upload fails, how should the status appear?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Specific status: show Image not saved beside the title; clicking it identifies the affected image and offers recovery actions. Recommended. | Yes |
| 2 | General status: show Save failed beside the title; explain the image failure in the details. |  |

**User's choice:** Specific status: show Image not saved beside the title; clicking it identifies the affected image and offers recovery actions. Saved requires confirmation of both content and images.

### If saving has failed or stalled and the user tries to leave the board, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Warn before leaving: explain that some changes have not reached the server and let the user stay or leave. Preserve pending work locally where possible. Recommended. | Yes |
| 2 | Allow leaving immediately: retain pending work locally where possible and show its status when the user returns. |  |

**User's choice:** Warn before leaving: explain that some changes have not reached the server and let the user stay or leave. Preserve pending work locally where possible.

### Move to interrupted work or discuss save status further?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Move to interrupted work. | Yes |
| 2 | Discuss save status further. |  |

**User's choice:** Move to interrupted work.

## Interrupted work

### For an already open board, what should happen during a temporary connection loss or service outage?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Continue editing with local recovery: preserve changes in the browser, show them as pending, and send them after reconnection and a fresh access check. Recommended. | Yes |
| 2 | Pause editing until reconnection: preserve existing pending changes and resume editing once the service is available and access is confirmed. |  |

**User's choice:** Continue editing with local recovery: preserve changes in the browser, show them as pending, and send them after reconnection and a fresh access check. A known expired session still pauses editing until sign-in.

### When the user reopens that board in the same browser and pending changes are found, how should recovery work?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Recover automatically: after confirming the same account and editing permission, restore the pending work and retry saving. Show recovery progress beside the title. Recommended. | Yes |
| 2 | Ask before recovery: offer Restore pending changes or Open saved version, keeping the pending work available until explicitly discarded. |  |

**User's choice:** Recover automatically: after confirming the same account and editing permission, restore the pending work and retry saving. Show recovery progress beside the title.

### If the browser's local recovery storage becomes full or unavailable during an outage, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Pause further editing: keep existing work visible and offer Download recovery copy and Retry saving. Recommended. | Yes |
| 2 | Let the user choose to continue: explain that further edits will remain only in memory and may be lost if the tab closes. |  |

**User's choice:** Pause further editing: keep existing work visible and offer Download recovery copy and Retry saving.

### If a user leaves a board with pending changes, how should those changes appear in the board library?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Mark the board card: show Changes waiting to save in the browser holding that pending work, until saving succeeds. Recommended. | Yes |
| 2 | Show status inside the board only: display the pending state when the user opens it again. |  |

**User's choice:** Mark the board card: show Changes waiting to save in the browser holding that pending work, until saving succeeds.

### Move to deployment expectations or discuss interrupted work further?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Move to deployment expectations. | Yes |
| 2 | Discuss interrupted work further. |  |

**User's choice:** Move to deployment expectations.

## Deployment expectations

### What environment should the first supported deployment target?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Single Linux server with containers: provide a repeatable deployment with persistent storage. Recommended starting point. |  |
| 2 | Existing container platform: fit Dali into the established hosting platform; identify the platform. | Yes |
| 3 | Direct Linux installation: run Dali as a managed service without containers. |  |

**User's choice:** Existing container platform: Kubernetes.

### What availability should upgrades provide?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Brief planned maintenance is acceptable: preserve pending work and recover automatically when service returns. Recommended for the initial deployment. | Yes |
| 2 | Keep the application available during upgrades: support deployment changes without a planned service outage. |  |

**User's choice:** Brief planned maintenance is acceptable; preserve pending work and recover automatically when service returns. The subsequent answer sets the permitted duration to up to one day when necessary.

### What should the maximum planned downtime per upgrade be?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 5 minutes. Recommended target. |  |
| 2 | 15 minutes. |  |
| 3 | 30 minutes. |  |
| 4 | Specify a different limit. | Yes |

**User's choice:** It could be 1 day if necessary. It will be internally deployed.

**Notes:** User-specified override: up to 24 hours of planned maintenance when necessary, for internal deployment. This does not establish the disaster-recovery time or acceptable data-loss window.

### Are there existing Kubernetes platform standards the deployment must follow for storage, ingress/TLS, secrets, or release tooling?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | No additional constraints: propose a portable deployment during research, with operator configuration maintained outside the repository. | Yes |
| 2 | Follow existing standards: describe the required services or conventions so the plan fits the platform. |  |

**User's choice:** No additional constraints: propose a portable deployment during research, with operator configuration maintained outside the repository.

### Move to backups and restoration or discuss deployment further?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Move to backups and restoration. | Yes |
| 2 | Discuss deployment further. |  |

**User's choice:** Move to backups and restoration.

## Backups and restoration

### If server storage is lost and Dali must recover from a backup, how much recent saved work is acceptable to lose?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Up to 1 hour. Recommended starting target. | Yes |
| 2 | Up to 24 hours. |  |
| 3 | No acknowledged saved changes: require a recovery design that preserves every confirmed save. |  |

**User's choice:** Up to 1 hour.

### How long should backups be retained?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | 30 days. Recommended starting target. | Yes |
| 2 | 7 days. |  |
| 3 | 90 days. |  |

**User's choice:** 30 days.

### After a storage failure, how quickly should operators be able to restore Dali to usable service?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Within 24 hours. Recommended starting target for this internal deployment. | Yes |
| 2 | Within 4 hours. |  |
| 3 | Within 1 hour. |  |

**User's choice:** Within 24 hours, including restoration of board content and images and verification that authorized users can reopen them.

### How should restoration from a backup be initiated?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Operator-initiated: an operator selects a backup, runs the documented restore procedure, and verifies the recovered service before reopening access. Recommended. | Yes |
| 2 | Automatic disaster recovery: the system detects a storage failure and attempts restoration from the latest usable backup. |  |

**User's choice:** Operator-initiated. Scheduled backups run automatically in either case.

### Finalize the Phase 4 context for research and planning, or discuss/revise any decision?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | Finalize the Phase 4 context for research and planning. | Yes |
| 2 | Discuss or revise any decision. |  |

**User's choice:** Finalize the Phase 4 context for research and planning.

## Implementation discretion

The user imposed no additional Kubernetes platform standards. Research chooses portable deployment packaging, storage, ingress/TLS, secret handling and release tooling. Retry timing, storage mechanics and backup implementation remain research/planning choices within the locked behavior and recovery targets.

## Deferred Ideas

No new deferred features. Existing Phase 5 collaboration scope and backlog 999.3/999.4 retain their allocation.
