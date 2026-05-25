# FlowBase UI Theme

**Concept:** Fresh · Modern · Cozy — a workspace that feels alive and inviting, not sterile or dull. Vibrant accent colors on a clean, lightly-tinted canvas.

---

## Color Palette

### Base
| Token | Value | Usage |
|---|---|---|
| `--app-bg` | `#F4F3FF` | Main content area background (light lavender wash) |
| `--sidebar-bg` | `#FFFFFF` | Sidebar background |
| `--sidebar-border` | `#EDE9FE` | Sidebar right border |
| `--card-bg` | `#FFFFFF` | Card & panel backgrounds |

### Text
| Token | Value | Usage |
|---|---|---|
| `--text-heading` | `#1E1B4B` | Page headings (deep indigo) |
| `--text-body` | `#4B5563` | Body / paragraph text |
| `--text-muted` | `#94A3B8` | Labels, timestamps, hints |
| `--text-group-label` | `#CBD5E1` | Sidebar group labels (ALL CAPS) |

### Brand
| Token | Value | Usage |
|---|---|---|
| `--primary` | `#6D28D9` | Primary CTA, active states |
| `--primary-light` | `#8B5CF6` | Hover, highlights |
| `--primary-subtle` | `#EDE9FE` | Active nav item backgrounds |

### Icon Accent Colors (per feature)
| Feature | Color | Hex |
|---|---|---|
| Dashboard | Blue | `#3B82F6` |
| AI Assistant | Violet | `#8B5CF6` |
| Calendar | Cyan | `#06B6D4` |
| Task / Kanban | Orange | `#F97316` |
| Notes | Amber | `#EAB308` |
| Whiteboard | Pink | `#EC4899` |
| Pages / Spaces | Emerald | `#10B981` |
| AI Template Builder | Purple | `#A855F7` |
| Settings | Slate | `#64748B` |
| Help & Support | Sky | `#0EA5E9` |

### Semantic
| Token | Value |
|---|---|
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Error | `#EF4444` |
| Info | `#3B82F6` |

---

## Typography

**Font Family:** `Plus Jakarta Sans` (Google Fonts)  
Fallback: `Inter`, `system-ui`, `sans-serif`

| Scale | Size | Weight | Usage |
|---|---|---|---|
| Page Title | `24px` / `1.5rem` | 700 | `h1` on dashboard pages |
| Section Heading | `16px` / `1rem` | 600 | Card titles, section labels |
| Body | `14px` / `0.875rem` | 400 | General content |
| Small | `12px` / `0.75rem` | 400–500 | Metadata, captions |
| Micro | `10px` / `0.625rem` | 600 | Sidebar group labels (uppercase + wide tracking) |

---

## Spacing

Uses Tailwind's default 4px base unit.

| Token | Value | Usage |
|---|---|---|
| `xs` | `4px` | Tight gaps (icon → label) |
| `sm` | `8px` | Inner padding, small gaps |
| `md` | `16px` | Card padding, section gaps |
| `lg` | `24px` | Page section separation |
| `xl` | `32px` | Page-level padding |

---

## Border Radius

| Component | Radius |
|---|---|
| Buttons, inputs | `0.5rem` (8px) |
| Cards, panels | `1rem` (16px) |
| Large cards | `1.25rem` (20px) |
| Avatars, tags | `9999px` (full pill) |
| Nav items | `0.5rem` (8px) |

---

## Shadows

| Name | CSS | Usage |
|---|---|---|
| `sm` | `0 1px 3px rgba(109,40,217,0.06)` | Cards, sidebar toggle |
| `md` | `0 4px 16px rgba(109,40,217,0.08)` | Modals, dropdowns |
| `lg` | `0 8px 32px rgba(109,40,217,0.12)` | Overlays, command palette |

---

## Component Guidelines

### Sidebar
- **Width expanded:** `220px` | **Width collapsed:** `64px`
- Smooth width transition: `300ms ease-in-out`
- Group labels: `10px`, `font-semibold`, `uppercase`, `tracking-widest`, color `#CBD5E1`
- Nav items: `12px`, `font-medium`, `rounded-lg`, `py-1.5 px-2`
- Active item: `bg-violet-50`, text in brand color, colored dot indicator on right
- Collapsed: icons only, `title` attribute for tooltip on hover
- Toggle button: floating circle on sidebar right edge at `top-[72px]`

### Cards
- `bg-white`, `rounded-2xl`, `border border-slate-100`
- Subtle gradient variants for stat cards: `from-{color}-50 to-{color}-50`
- Hover: `border-violet-200`, `shadow-sm`

### Buttons
- Primary: `bg-violet-600 text-white hover:bg-violet-700`
- Ghost: `hover:bg-violet-50 hover:text-violet-700`
- Size: `text-xs`, `px-3 py-1.5`, `rounded-lg`

### Icons
- Size: `16px` for nav, `14px` for inline, `20px` for feature headers
- Always colored (never monochrome gray) using the per-feature accent colors above
- When inactive: `color + "99"` (60% opacity version of the full color)

---

## Motion

| Type | Duration | Easing |
|---|---|---|
| Sidebar collapse | `300ms` | `ease-in-out` |
| Nav hover | `150ms` | `ease` |
| Card hover | `200ms` | `ease` |
| Modal open | `200ms` | `ease-out` |

---

## Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Use vibrant feature icon colors | Make all icons gray/monochrome |
| Keep backgrounds very light (near-white) | Use heavy dark backgrounds in light mode |
| Apply `font-medium` or `font-semibold` sparingly | Bold everything — use weight hierarchy |
| Use `rounded-xl` / `rounded-2xl` for cards | Use sharp square corners |
| Space out content generously | Crowd elements — breathe! |
