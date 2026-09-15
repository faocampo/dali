---
status: complete
completed: 2026-09-15
implementation: b188a47
---
# Header cleanup

Removed Full DJAI Canvas and the duplicate header Export button after confirming both export routes open the same ExportDialog. The left-toolbar Export board control remains, including focus restoration after dialog dismissal. Save status and recovery controls remain available.

Validation: typecheck and production build passed; 37/37 affected production browser tests passed, including dialog opening/Escape focus, decoded image exports, error recovery and mind-map exports. The open local app DOM confirms both removed controls are absent and the toolbar export remains. Source/privacy and whitespace checks passed. Existing bundle-size advisory remains. No phase advancement or user acceptance is inferred.
