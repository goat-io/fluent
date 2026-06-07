/**
 * Lens + mode plug-in registry. Phase 7 of brain-llm-wiki-evolution-plan.md
 * (scaffold — Phase 1 of UnifiedView refactor will wire this in).
 *
 * Reads all manifests from _instance/lenses/*.json and all renderer modules
 * from _instance/modes/*.jsx at build time via Vite's import.meta.glob.
 *
 * Public API:
 *   listLenses()           — array of lens manifests (sorted by label)
 *   getLens(name)          — one manifest or undefined
 *   listModes()            — { name → { default: Component, label?, icon?, supports? } }
 *   getMode(name)          — one mode module or undefined
 *
 * Spec for manifests: ../lenses/README.md
 * Spec for modes:     ../modes/README.md
 */

const lensModules = import.meta.glob('../lenses/*.json', { eager: true })
const modeModules = import.meta.glob('../modes/*.jsx', { eager: true })

const lenses = {}
for (const [path, mod] of Object.entries(lensModules)) {
  const data = mod.default || mod
  if (!data || !data.name) continue
  lenses[data.name] = data
}

const modes = {}
for (const [path, mod] of Object.entries(modeModules)) {
  // Filename minus extension = mode name
  const match = path.match(/\/([^/]+)\.jsx$/)
  if (!match) continue
  modes[match[1]] = mod
}

export function listLenses() {
  return Object.values(lenses).sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name))
}

export function getLens(name) {
  return lenses[name]
}

export function listModes() {
  return modes
}

export function getMode(name) {
  return modes[name]
}

// Convenience: which modes does THIS lens support?
export function modesForLens(lens) {
  if (!lens || !lens.modes) return []
  return lens.modes.filter((m) => {
    const mod = modes[m]
    if (!mod) return false
    if (typeof mod.supports === 'function') return mod.supports(lens)
    return true
  })
}
