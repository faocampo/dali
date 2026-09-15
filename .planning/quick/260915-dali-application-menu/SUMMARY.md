---
status: complete
completed: 2026-09-15
---
# Dalí application menu

Moved floating Export, Import and Help controls and the All boards button into the top-bar Dalí dropdown. File groups library navigation and file operations; View groups existing fit, zoom reset and Layers; Help preserves shortcuts and upstream attribution. Inline board naming remains available. No future grid or collaboration functionality is implied by the View menu.

Menu supports arrow keys, Home/End, nested Escape/Left, outside dismissal, and submenu focus. Export restores focus to Dalí. Import retains direct user-gesture activation of the existing file picker.

Validation: typecheck and production build passed; 31 file/editor browser regressions passed; 21 focused menu/accessibility cases passed across Chromium, Firefox and WebKit. Desktop and narrow-screen visual checks passed. Static detector returned no findings. Existing build advisories remain. Native screen-reader speech was not tested. Phase acceptance is unchanged.
