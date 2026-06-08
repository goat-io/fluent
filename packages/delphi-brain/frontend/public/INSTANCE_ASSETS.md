# Public assets — instance vs generic

Vite's `public/` directory is served at the site root. We keep all assets here for technical reasons (Vite's static-serving model), but conceptually they split into two groups.

## Generic Brain assets (keep)

| Path | Purpose |
|------|---------|
| `favicon.{ico,png,svg}` | Browser favicons — generic Brain icon |
| `icons.svg` | UI icon sprite |
| `logos/` | Technology vendor logos (AWS, EKS, Kafka, Grafana, …) — applicable to any company |

## Instance assets (replace per company)

| Path | Purpose | Used by |
|------|---------|---------|
| `instance-logo.png` | Brand logo shown in app header | `src/App.jsx` via `_instance/lib/branding.js` |
| `books/` | Book cover images for slide decks | `_instance/views/*` slide decks |
| `people/` | Headshot images for slide decks | `_instance/views/*` slide decks |
| `products/` | Product images | `_instance/views/*` slide decks |

When extracting Brain for another company, replace the instance entries with that company's equivalents (or delete them — the generic frontend falls back gracefully).
