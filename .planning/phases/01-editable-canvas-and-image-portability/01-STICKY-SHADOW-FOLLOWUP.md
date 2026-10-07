# Sticky shadow rendering

The native style panel stores a note shadow token. The native background component resolves that token through a CSS custom property. The embedding application's theme omitted all five properties, so each selected shadow resolved to `none`.

Defined Box, Sticker, Paper, Floating, and Film shadow values in the application theme. The native No shadow option continues to resolve to `none`.

Validation: TypeScript and production build passed. Four browser regression cases passed (development Chromium; production Chromium, Firefox, WebKit), each checking all five distinct computed shadows, No shadow, and reload persistence.

The user approved the copy-and-paste use case. Image-import and clipboard acceptance are recorded in 01-UAT.md. Phase closure still needs the follow-up verification state refreshed.
