# Local board lifecycle repair

## Cause and change

The synthetic local launcher did not supply a backup configuration or an explicit development storage policy. The server therefore fenced durable writes. Creation could not receive an acknowledgment, and board deletion was rejected by the same admission gate.

The loopback-only development composition now explicitly uses the fixture storage policy. Board content remains persisted in local SQLite; backup freshness is simulated and identified in startup output and local-development documentation. Production backup configuration and write admission remain unchanged.

## Verification

- Reproduced creation failure in the running local application.
- RED launcher regression: storage health was fenced before the change.
- Actual development launcher: all four suites passed, covering sign-in, create, edit, save, restart/reopen, session persistence, role restrictions, sharing/revocation, deletion from canvas and library, sign-out, startup rejection, and shutdown.
- Production write-admission server tests: 113 passed.
- Live application restarted with its existing database and sessions retained. Created a synthetic verification board, edited a note, reloaded it, observed Saved and retained text, and returned to the library without a pending marker.
- Cross-browser board action/library tests: 84 passed across production Chromium, Firefox and WebKit.
- File > New follow-up passed against the real development launcher: new-tab creation, save acknowledgment, source preservation, and deletion.
- Frontend/server TypeScript, development compilation, JavaScript syntax checks and production build passed.
- Implementation commit: `6c5ec19`.

Existing boards were retained. Deletion tests used disposable synthetic boards in isolated test state. Phase 4 final acceptance remains open.
