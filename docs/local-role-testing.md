# Local board permissions

The local development sign-in page provides synthetic accounts. Open **Shared role test** from the board library to exercise these permissions:

| Account | Role on Shared role test | Expected behavior |
| --- | --- | --- |
| Synthetic Owner | Owner | Edit the board and manage sharing. |
| Synthetic Editor | Editor | Edit the board. |
| Synthetic Viewer | Viewer | Read and navigate; the account menu shows **Viewer · View only**. |
| Synthetic Internal Member | No grant | Sign in, with no access to this sample board. |
| Synthetic External Account | Not admitted | Sign-in is rejected. |

Viewer is a system-wide read-only role. Synthetic Viewer cannot create, import or modify boards, including any boards it owned before this policy was enabled. Other admitted members can create boards and receive Owner, Editor or Viewer access separately on each board.

The local launcher creates the sample once per local development state directory. Existing boards retain their content and permissions. Sample edits, sharing changes and deletion survive restarts. The synthetic sign-in and sample seeding are part of local development only.

To retest, sign in as Synthetic Editor and add an object to Shared role test. Open the same board as Synthetic Viewer in a separate browser profile. Confirm the **Viewer · View only** account-menu label, hidden creation tools, unchanged content after typing or deletion, and working navigation.

Sources: [local sample setup](../scripts/dev-role-board.ts) (one-time synthetic board and grants), [board authorization](../server/boards/routes.ts) (per-board capabilities), and [startup regression](../scripts/dev-startup.test.mjs) (signed role login, mutation denial and restart preservation).


## Identity-provider configuration

Set `DALI_ROLE_CLAIM` to the verified user-info claim that carries application roles and `DALI_EDITOR_VALUES_JSON` to the JSON array of values permitted to create and edit (for example, `["editor"]`). An admitted identity with a missing or unmatched role becomes a system Viewer. Membership admission and board grants still apply. When the optional role claim is unset, admitted identities retain the existing per-board permission model. Roles refresh on successful sign-in and apply to all existing sessions for that identity. The local launcher configures these fields automatically using synthetic claims.
