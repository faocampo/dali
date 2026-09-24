# Local board permissions

The local development sign-in page provides synthetic accounts. Open **Shared role test** from the board library to exercise these permissions:

| Account | Role on Shared role test | Expected behavior |
| --- | --- | --- |
| Synthetic Owner | Owner | Edit the board and manage sharing. |
| Synthetic Editor | Editor | Edit the board. |
| Synthetic Viewer | Viewer | Read and navigate; the header shows **Viewer · View only**. |
| Synthetic Internal Member | No grant | Sign in, with no access to this sample board. |
| Synthetic External Account | Not admitted | Sign-in is rejected. |

Roles belong to individual boards. Any admitted internal member who creates a board owns that board, including the account named Synthetic Viewer. Use the shared sample to test its Viewer grant.

The local launcher creates the sample once per local development state directory. Existing boards retain their content and permissions. Sample edits, sharing changes and deletion survive restarts. The synthetic sign-in and sample seeding are part of local development only.

To retest, sign in as Synthetic Editor and add an object to Shared role test. Open the same board as Synthetic Viewer in a separate browser profile. Confirm the **Viewer · View only** header, hidden creation tools, unchanged content after typing or deletion, and working navigation.

Sources: [local sample setup](../scripts/dev-role-board.ts) (one-time synthetic board and grants), [board authorization](../server/boards/routes.ts) (per-board capabilities), and [startup regression](../scripts/dev-startup.test.mjs) (signed role login, mutation denial and restart preservation).
