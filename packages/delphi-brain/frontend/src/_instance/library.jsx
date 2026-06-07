/**
 * Curated document library — what surfaces under the "Featured" tab in the
 * Documents view.
 *
 * Supported document shapes:
 *   - `kind: 'slides'`    — a slide deck (array of components from _instance/views/)
 *   - `kind: 'markdown'`  — a path to a .md file already indexed by Brain CLI
 *   - `kind: 'component'` — escape hatch for fully custom views
 *
 * The generic Documents view also auto-lists every other indexed .md under the
 * "All" tab — no need to register every narrative file here.
 *
 * This is the GENERIC EXAMPLE instance: empty by default. When you fork Brain
 * for a real company, add that company's curated picks here.
 */
export const LIBRARY = []
