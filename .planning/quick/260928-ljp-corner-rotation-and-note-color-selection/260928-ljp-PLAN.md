---
status: complete
quick: 260928-ljp
---
# Corner rotation and note colors

1. Expose the native bottom-right rotation target as a visible, distinct grip, preserving native resize, rotation history, persistence, and locked/read-only restrictions.
2. Replace immediate note insertion with an accessible, labeled color palette. Choosing a color creates one native sticky in available viewport space; dismissing creates none. Preserve the default yellow for programmatic callers.
3. Update browser setup interactions to choose a note color explicitly. Verify rotation with actual pointer gestures, undo/redo and reload; palette creation, dismissal, keyboard navigation, persistence and narrow viewport positioning. Run static checks and targeted browser suites in the three production engines.

Execute inline. Keep unrelated working changes and incomplete Phase 4 acceptance evidence intact. The full Phase 4 run was interrupted after ordinal 1560, with seven known assertion failures; it remains incomplete.
