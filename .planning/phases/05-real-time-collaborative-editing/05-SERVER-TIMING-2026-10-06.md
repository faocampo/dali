# Server timing investigation after the local delivery

Source under investigation: `c072cb9f5113839445787ab3eab87392dee93007`, identical product/server tests to the verified 05-04 cut. The delivered branch and running synthetic trial were not modified or restarted.

## Preserved initial result

The first delivery run used one server worker but overlapped frontend compilation, client tests and the integrated browser gate. It passed **373/375** in **479.65s**. Two real-storage cases exceeded their unchanged **5000ms** test limit:

- `backup.test.ts`: inspection ignores partial, tampered and unsupported sets without editing them.
- `restore.test.ts`: selected restore preserves content and access while invalidating sessions and rotating epoch.

Both passed in an unchanged focused rerun, **2/2**, but that did not establish a passing full server run. The original failure is retained separately.

## Isolated full check

A third detached checkout of the exact delivery commit ran the complete server suite with one worker and reduced CPU priority. No build, browser or client gate ran alongside it. It used its own fixtures and temporary data, with no traffic to or reuse of trial services/storage. The trial process remained running.

Command: `nice -n 15 npm run test:server -- --maxWorkers=1 --reporter=default --reporter=json --outputFile=<private-report>` under a command-lifetime idle-sleep assertion.

Result: **375/375 across 18 files**, **0 failed**, **0 pending**, **228.11s**. No source, assertions or timeout changes were made. The previously failing cases took **2351.45ms** and **3507.14ms**, respectively.

The representative local I/O fixture also passed. Its backup duration changed from approximately 11.35s in the overlapping run to 7.05s in isolation; restore changed from 105.47s to 73.35s. These are synthetic local measurements, not production RPO/RTO claims or an independent-storage acceptance.

## Diagnosis and operating decision

The unchanged assertions and source pass in the complete isolated run. The timing comparison supports resource contention during simultaneous gates as the explanation; no functional storage defect was reproduced. This does not prove the absence of all timing-sensitive defects or guarantee performance under arbitrary host load.

Keep storage-heavy full verification separate from frontend compilation and browser gates. Do not extend timeouts, suppress failures or relabel the initial 373/375. The new complete 375/375 result supersedes the earlier lack of a clean full delivery rerun while preserving that history. No new release or Phase 5 acceptance is implied.
