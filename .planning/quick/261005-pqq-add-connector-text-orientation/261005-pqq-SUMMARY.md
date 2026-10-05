---
status: complete
---
# Connector text orientation

Added a Text orientation selector with Stay horizontal (default) and Follow line. The latter follows the routed connector tangent at the label position and keeps letters upright. The setting is stored in native label style and survives save/reload. Canvas rendering, the label cutout, DOM rendering, editing and label selection geometry use the chosen orientation.

Validation: all 10 focused production Chromium tests passed, covering straight, angled and curved connectors, rendered angles, persistence, editing position, switching back to horizontal, existing wrapping/history, zoom and delayed font loading. Client and server static checks and whitespace validation passed. Visually inspected rotated text editing using synthetic data.

An intermediate position assertion exposed rotation of the editor's translation. Appending rotation after native positioning corrected it; the full focused suite then passed.

Implementation commit: `ce28c5a`. Unrelated Phase 5 work and its outstanding verification remain separate.
