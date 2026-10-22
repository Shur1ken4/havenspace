# HavenSpace design system

"A quiet room": calm, warm, unhurried. Every colour, corner and text size comes from the tokens in `apps/web/src/app/globals.css`. No hard-coded colours in components (exceptions: the QR code's white background, the always-dark video stage).

## Colour tokens (light / dark)
| Token | Use | Text contrast |
|---|---|---|
| `bg`, `surface`, `surface-2` | page, cards, quiet fills | — |
| `ink` | body text | 11:1 / 12.7:1 |
| `muted` | secondary text | ≥ 4.7:1 on every surface |
| `primary` | sage accents, focus rings, icons (not small text) | — |
| `primary-strong` | links, filled buttons, active states | 5.3:1 |
| `on-primary` | text on a filled sage or destructive button (white in light, charcoal in dark) | 5.9:1 / 7.6:1 |
| `primary-soft` | selected chips and nav | — |
| `calm-blue` / `calm-blue-strong` | client's colour in transcripts; use `-strong` for text | 5.0:1 |
| `attention` / `attention-strong` | gentle warnings (never red); use `-strong` for text | 5.6:1 |
| `destructive` | delete actions only | 5.3:1 |
| `accent`, `accent-soft` | clay highlights, illustrations | — |
| `line` | hairline borders | — |

Rule: small text must reach WCAG AA 4.5:1 in both themes. Check new pairs before using them.

## Corners
| Class | Radius | Use |
|---|---|---|
| `rounded-inner` | 10px | something inside another rounded box (tab triggers, nav items) |
| `rounded-control` | 12px | buttons, inputs, selects |
| `rounded-card` | 16px | cards, notices, panels, tab lists |
| `rounded-panel` | 22px | large hero and video surfaces |
| `rounded-full` | pill | chips, avatars, segmented switches |

## Type
Headings: Fraunces (Source Serif for Cyrillic). Body and UI: Inter, 16.5px, line height 1.6. `text-ui` = 15px for controls and labels; `text-sm` for hints.
Phones (under 640px): everything one step smaller: 1rem = 15px (so spacing and buttons shrink together), body 15.5px, `text-ui` 14.5px, and headings smaller still (`text-4xl` ≈ 29px). Set in `globals.css`; nothing per page.

## Components (`apps/web/src/components/ui`)
| Component | Variants / sizes | Notes |
|---|---|---|
| `Button` / `buttonClass` | primary, secondary, ghost, destructive · sm / md / lg | minimum heights (36/44/56px); labels may wrap on narrow phones |
| `Card` | — | `rounded-card`, hairline border, soft shadow (none in dark) |
| `Field` + `Input` / `Textarea` / `Select` | — | label always visible; error replaces hint with `role="alert"` |
| `Notice` | info, attention, success | calm tones, never alarming |
| `Chip` | sage, clay, blue, amber, plain | for status only, not for decoration |
| `Tabs` | — | scrolls sideways if tabs don't fit |
| `Dialog` | — | Radix; focus trapped, Escape closes |

## Layout rules
- Phones from 320px wide must never scroll sideways. Grid items may shrink (`.grid > * { min-width: 0 }`); rows of buttons use `flex-wrap`; menus that may not fit use `overflow-x-auto`.
- One primary button per screen area.
- Motion is slow and stops entirely for people who prefer reduced motion; off-screen animations pause.
- Every interactive element shows the `focus` outline when reached by keyboard.
