# Phase 3: Okta and Board Access - Discussion Log

> Audit trail only. Downstream research, planning and execution use `03-CONTEXT.md` (canonical decisions).

**Date:** 2026-09-15
**Phase:** 03-okta-and-board-access
**Areas:** Sign-in and sessions; sharing defaults; role capabilities; board home and existing work.

The user selected all four areas. After ten individual decisions, the user instructed: “move forward with recommended options.” Remaining defaults were selected under that delegation.

## Sign-in and sessions

### When someone opens Dali while signed out, how should they enter?

| Option presented | Selection |
|------------------|-----------|
| Dali sign-in page with Continue with SSO |  |
| Redirect immediately to Okta | User selected |

**Decision:** Redirect immediately to Okta, then return to the requested board or the board library.

### If a session expires while someone is editing, what should happen?

| Option presented | Selection |
|------------------|-----------|
| Pause and prompt | User selected |
| Reauthenticate automatically |  |

**Decision:** Pause and prompt: lock editing, preserve pending work, and show Session expired — sign in to continue. Resume the same board after authentication.

### When someone explicitly signs out, what should happen?

| Option presented | Selection |
|------------------|-----------|
| Sign out of Dali only | User selected |
| Also end the Okta SSO session |  |

**Decision:** Sign out of Dali only. End the Dali session and show a signed-out page with Sign in again. Do not immediately start automatic login from that page.

### Should sign-in persist after users close and reopen the browser?

| Option presented | Selection |
|------------------|-----------|
| Keep them signed in | User selected |
| Start SSO again each browser session |  |

**Decision:** Keep them signed in: reuse their session until the operator-configured expiry.

---

## Sharing defaults

### How should a newly created board start?

| Option presented | Selection |
|------------------|-----------|
| Private by default | User selected |
| Choose sharing during creation |  |

**Decision:** Private by default. Only its owner can access it; the owner can share it afterward.

### Who should owners be able to share with?

| Option presented | Selection |
|------------------|-----------|
| Existing Dali members |  |
| Existing members plus first-time users | User selected |

**Decision:** Existing members plus first-time users. Owners can search existing internal members or enter an internal email; access becomes available after that person's first valid SSO sign-in.

### Which role should the sharing dialog select by default?

| Option presented | Selection |
|------------------|-----------|
| Viewer | User selected |
| Editor |  |

**Decision:** Viewer. The owner can explicitly change it to Editor.

### How should shared board links work?

| Option presented | Selection |
|------------------|-----------|
| Explicit access only | User selected |
| Optional internal link sharing |  |

**Decision:** Explicit access only. A link opens the board only for its owner and members granted access; possession of a link does not grant access.

---

## Role capabilities

### Which export actions should viewers have?

| Option presented | Selection |
|------------------|-----------|
| Visual exports only | User selected |
| All export formats |  |
| No export actions |  |

**Decision:** Visual exports only: PNG and PDF. Editable board downloads are limited to owners and editors.

### Who should be able to duplicate a board into a new private, editable copy?

| Option presented | Selection |
|------------------|-----------|
| Owners and editors only | User selected |
| Viewers too |  |

**Decision:** Owners and editors only. The person making the copy owns the new private board.

### Who should be able to rename a board?

| Option presented | Selection |
|------------------|-----------|
| Owners and editors (Recommended) | Recommended option accepted through delegation |
| Owners only |  |

**Decision:** Owners and editors.

### Who can delete a board?

**Basis:** Recommended default selected under delegation; no separate question or alternatives were presented.

**Decision:** Only the owner, with a confirmation naming the board.

---

## Board home and existing work

### What should opening Dali without a board link show?

**Basis:** Recommended default selected under delegation; no separate question or alternatives were presented.

**Decision:** The authenticated board library. An explicit board link resumes that board after authentication and authorization.

### How should accessible boards be organized?

**Basis:** Recommended default selected under delegation; no separate question or alternatives were presented.

**Decision:** Reuse board cards, newest updated first, with All, Mine, and Shared with me filters. Show private/shared status and the current member's role on each card.

### How should creation and naming fit the current editor?

**Basis:** Recommended default selected under delegation; no separate question or alternatives were presented.

**Decision:** Keep File > New opening a fresh board in another browser tab and retain the editable header title. New boards belong to the creator and start private; allow an Untitled board default.

### How should existing browser-local boards enter the authenticated experience?

**Basis:** Recommended default selected under delegation; no separate question or alternatives were presented.

**Decision:** Offer an explicit copy/import of selected local boards into the signed-in account as private boards, preserving originals, names, documents and images. Keep local work distinguishable from account boards until imported.

---

## Implementation discretion

Research and planning resolve the technical implementation and routine presentation details within the recorded outcomes. The user's delegation covers the remaining discussion defaults and completion of context capture.

## Deferred ideas

No new deferred feature ideas. The approved Phase 4/5 delivery sequence and later roadmap remain in place.
