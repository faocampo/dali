# Dalí design system

Dalí is a collaborative canvas. Its interface prioritizes editing space, precise controls, readable state, and predictable actions. The existing eye logo supplies the visual identity.

## Source and palette

The canonical palette comes from [the committed color symbol](imgs/svg/dali-symbol-color.svg). The wordmark appears in the library; the compact symbol appears in the editor.

| Role | Color | Use |
|---|---|---|
| Logo plum | `#171126` | Main text, icons, tooltip surface |
| Logo violet | `#7248FF` | Source accent |
| Action violet | `#6840E8` | Primary actions, focus, selected tools |
| Violet hover | `#5530CA` | Primary action hover |
| Violet ink / tint | `#4E2AA5` / `#EEE8FF` | Selected controls and roles |
| Logo pink | `#FF4FB8` | Brand artwork, decorative identity |
| Logo gold | `#FFB74B` | Brand artwork, decorative identity |
| Muted plum | `#6B6179` | Secondary labels and descriptions |
| Workspace | `#F7F6FA` | Library background |
| Surface / subtle | `#FFFFFF` / `#F4F1F8` | Panels, menus, subordinate areas |
| Divider / field border | `#E4DEEB` / `#91859F` | Group separation / input boundaries |
| Success | `#34704C` | Saved and completed states |
| Warning | `#865900` | Caution, on `#FFF4DA` |
| Danger | `#B12D52` | Errors and destructive actions, on `#FFF0F4` |

Bright pink and gold remain in the logo artwork. Meaningful controls use contrast-tested violet and plum. Status colors keep their semantic meaning. The drawing surface retains warm paper, grid dots, and existing document swatches so board content remains visually stable.

## Implementation

- [Semantic tokens](src/styles/tokens.css) define color, typography, spacing, radius, elevation, and native BlockSuite aliases. This is the canonical value source.
- [Shared controls](src/styles/controls.css) define low-specificity application primitives, focus, browser selection, input defaults, and disabled states.
- [Component styles](src/index.css) define layout and surface-specific composition.
- [Menu icons](src/header/MenuIcon.tsx) provide consistent decorative SVGs. Actions retain visible text or accessible names.

Use semantic tokens in new UI. Keep application styling scoped to chrome rather than editable board content. Theme variables inherit into native editor shadow roots. Retain native control semantics and focus behavior.

## Typography and spacing

The interface uses the locally bundled Inter variable font through the `Dali UI` family. Body text is 14px, compact controls 13px, metadata 12px, panel titles 16–20px, and page titles 28px (24px on narrow screens). Body line height is 1.5. Page titles use -0.025em tracking. Measurements and save ages use tabular numbers where useful.

The spacing scale is 4, 8, 12, 16, 24, 32, and 48px. Related controls sit 8px apart; panel padding is 16–24px. Separate library sections by 24–32px. Pointer controls normally have a 44px target; dense canvas controls preserve their established 40px geometry.

Control radius is 8px, floating surfaces and board cards 12px, dialogs 16px. Floating menus and dialogs use plum-tinted offset shadows. Persistent cards use a border; elevation identifies overlays. Circles identify avatars and connector handles.

## Surface patterns

- **Library:** wordmark left, Import and account right; plain page heading, adjacent creation form on wide screens; selected filter uses a violet tint. Cards contain a preview, title, edit date, quiet access metadata, and one actions menu.
- **Editor:** symbol, main menu, borderless editable title and save age; sharing and account actions on the right. Account roles stay inside the account menu.
- **Menus:** 18px icon column, text, optional trailing shortcut/state. Group related actions with a subtle divider. Selected categories use violet tint and ink.
- **Dialogs:** consistent title/action alignment, scrollable body, persistent footer where needed. Destructive actions are explicitly labeled and use danger ink.
- **Inspectors and palettes:** white floating surface; compact labeled fields; selected tools share the same violet semantics.
- **Recovery and feedback:** calm readable panel, explicit problem and recovery action. Canvas errors appear beside the toolbar without expanding it.

## Interaction and accessibility

Preserve click-to-edit titles, keyboard menu navigation, modal focus containment/return, permission-dependent actions, and disabled states. Use a 2px violet keyboard outline with 2px offset. Labels and placeholders target 4.5:1 contrast; input boundaries target 3:1. Main text and primary button labels exceed 4.5:1.

Menus enter with one 160ms vertical settling animation; reduced motion removes it. Default content remains visible. Scrollbars, carets, text selection, and native form accents use the shared palette. Color is accompanied by text, icon, or selection state.

## Responsive behavior

Check 390px, 768px, and 1456px widths. The library creation form stacks below the heading below 900px. Account names collapse to initials on narrow screens. Dialog bodies scroll while actions stay reachable. Share role controls stack into two columns on narrow screens. Menus remain inside the viewport. The canvas remains the primary workspace.
