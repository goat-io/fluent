# Service Catalog Explorer — Style Guide

## Layout

**Navigation: Collapsible sidebar + command palette**
- Sidebar: 256px expanded, 56px collapsed (icon-only with tooltips). Persist in localStorage.
- Command palette (cmdk): `Cmd+K` / `Ctrl+K` global shortcut.
- Top bar: 48px height. Breadcrumb left, search trigger + user avatar right.
- Hide sidebar below 768px; replace with hamburger slide-over drawer.

**Content density**
- Base unit: 4px. Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Max content width: 1280px for prose, full-width for tables/diagrams.
- Card padding: 16px. Table cell padding: 8px 12px. Section gaps: 24px.

## Color

**Dark mode as default.** Light mode via `class` strategy on `<html>`.

```css
:root[class="dark"] {
  --background:      hsl(222 47% 6%);    /* #0B0F1A */
  --surface:         hsl(222 35% 12%);   /* #161B2E */
  --surface-raised:  hsl(222 25% 18%);   /* #232A3E */
  --surface-overlay: hsl(222 20% 24%);   /* #303850 */
  --border:          hsl(220 15% 30%);   /* #434D60 */
  --text-muted:      hsl(215 16% 62%);   /* #94A3B8 */
  --text:            hsl(210 40% 96%);   /* #F1F5F9 */
  --text-heading:    hsl(0 0% 100%);     /* #FFFFFF */
  --status-success:  hsl(142 71% 45%);   /* #22C55E */
  --status-warning:  hsl(38 92% 50%);    /* #F59E0B */
  --status-danger:   hsl(0 84% 60%);     /* #EF4444 */
  --status-info:     hsl(217 91% 60%);   /* #3B82F6 */
  --status-neutral:  hsl(215 16% 47%);   /* #64748B */
  --accent:          hsl(217 91% 60%);   /* #3B82F6 */
  --accent-hover:    hsl(217 91% 50%);
}
```

WCAG AA: `--text` on `--background` = ~15:1. `--text-muted` on `--background` = ~6.5:1.

## Typography

```css
--font-sans:  "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono:  "JetBrains Mono", ui-monospace, monospace;
```

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `text-xs` | 12px | 400 | Badges, metadata |
| `text-sm` | 14px | 400 | Table cells, secondary |
| `text-base` | 16px | 400 | Body |
| `text-lg` | 18px | 600 | Section headings |
| `text-xl` | 20px | 600 | Page titles |
| `text-2xl` | 24px | 700 | Hero / diagram labels |

Line height: 1.5 body, 1.25 headings.

## Components

### Tables
- Sticky header with `--surface-raised` bg
- Row hover: `--surface` → `--surface-raised`, 120ms ease
- Inline actions: appear on hover, icon buttons right-aligned
- Selected row: `--accent` 3px left border + `--surface-raised` bg

### Detail drawer
- Right-side, 480px wide (resizable, max 50vw). Full-screen on mobile.
- Sections: header (name + badges), metadata grid (2-col), description, deps diagram, related services
- Close: `Esc`, click outside, or button
- URL: `?service=icc-backend` for shareable links

### Search
- Sidebar: persistent filter for current view
- `Cmd+K`: global command palette. Groups: Services, Teams, Docs, Actions
- Fuzzy matching, recent searches persisted

### Status badges
- Colored dot (8px) + text label. Never color alone.
- `production` green, `prototype` blue, `sunset` amber, `dead` red, `unknown` grey
- Pill: `border-radius: 9999px`, padding `2px 10px`, `text-xs`, `font-medium`

### Loading
- Skeleton screens (pulse `--surface-raised` ↔ `--surface`, 1.5s). No spinners for layout.
- TanStack Query: `staleTime: 60_000`, `placeholderData: keepPreviousData`

## Interaction

- `/` focuses sidebar search
- `Cmd+K` opens command palette
- `j`/`k` or arrows navigate table. `Enter` opens detail.
- `Esc` closes drawer/palette/search
- Focus ring: `outline: 2px solid var(--accent); outline-offset: 2px` (`:focus-visible` only)
- Drawer slide-in: `translateX` 200ms `ease-out`
- Hover transitions: 120ms `ease`
- Respect `prefers-reduced-motion`
