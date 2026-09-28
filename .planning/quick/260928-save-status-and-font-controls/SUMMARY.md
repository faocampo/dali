# Save confirmation and text formatting fixes

## Changes

- Recovery rebuilds missing root/content confirmation history from authorized full server documents. This resolves stale Save failed after cold recovery when incremental acknowledgments lack their base structures and native synchronization is disconnected. Local checkpoints do not count as server confirmation, and current coverage checks continue to protect newer edits.
- Save details removes Select image and the misleading image-presence message. Image upload status is explicitly separate from board save status; genuinely removed references show that their removal is waiting to save. Unconfirmed saves use confirmation-oriented wording.
- Six locally bundled font families are offered: Inter, Kalam, Lora, Poppins, Bebas Neue and Orelega One. Style options reflect available bundled faces, update with the selected font, and persist with the canvas model. Added font assets retain upstream licenses and source references.

## Verification

- RED reproduction: with the confirmation fix removed, the cold-recovery regression remained Save failed after Retry now (25-second assertion timeout); the same scenario passes with the fix.
- Frontend unit tests: 236 passed across 20 files.
- Browser regression set: 111 distinct cases across production Chromium, Firefox and WebKit. The broad run passed 110/111; the sole failure was the mixed-frame responsive measurement. After correcting that helper and refining the dialog wording, all 36 affected final-build cases passed, including that case in all three browsers.
- TypeScript checks and production builds passed. Screenshots of the confirmation dialog and Lora Bold Italic text were reviewed; narrow/zoomed dialog controls remained reachable.
- Implementation commit: `9d4976b`.
- Responsive test correction: read action/button geometry in a single frame and poll after scrolling or resizing, avoiding mixed-layout measurements in Firefox while preserving the bounds assertion.

## Scope

This is a focused follow-up to user feedback. Phase 4 final acceptance remains open. Real-provider identity acceptance, assistive-technology acceptance, and independent storage-capacity validation retain their existing deferrals.
