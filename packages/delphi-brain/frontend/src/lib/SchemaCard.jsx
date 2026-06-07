/**
 * SchemaCard — generic entity renderer driven by Brain's runtime schema.
 *
 * Phase 1 scaffold of brain-llm-wiki-evolution-plan.md (§3.2). Reads the
 * JSON Schema for `kind` via `useSchema`, then renders `entry`'s fields
 * generically: required first, then everything else from properties order,
 * with simple type hints (string, array length, object key count).
 *
 * Designed to replace the polished kind-specific cards in a later phase.
 * Today this is the foundation — drop it into a view to verify the
 * runtime-schema pipe end-to-end. Per-kind polish lives behind
 * `_instance/<kind>-overrides.jsx` (escape hatch).
 *
 * Usage:
 *   <SchemaCard kind="repo" entry={catalogInfoJson} />
 *
 * Props:
 *   kind   — string, must match a registered schema (use useSchemaRegistry to enumerate)
 *   entry  — the parsed catalog-info.json object
 *   hide   — array of field names to suppress (default: none)
 *   compact — boolean; when true, omits the description column
 */
import React from 'react'
import { useSchema } from './useSchema'

function formatValue(v) {
  if (v === null || v === undefined) return <em style={{ opacity: 0.5 }}>—</em>
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) {
    if (v.length === 0) return <em style={{ opacity: 0.5 }}>[]</em>
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) return v.join(', ')
    return <span style={{ opacity: 0.7 }}>[{v.length} items]</span>
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v)
    return <span style={{ opacity: 0.7 }}>{`{${keys.length} keys}`}</span>
  }
  return String(v)
}

function fieldOrder(schema) {
  // Required first (in declared order), then the rest in `properties` order.
  // additionalProperties: true means entry keys may exist that aren't declared
  // — those are appended last so we don't lose them.
  const props = schema.properties || {}
  const required = Array.isArray(schema.required) ? schema.required : []
  const declared = Object.keys(props)
  const requiredSet = new Set(required)
  const optional = declared.filter((k) => !requiredSet.has(k))
  return [...required, ...optional]
}

export default function SchemaCard({ kind, entry, hide = [], compact = false }) {
  const { schema, loading, error } = useSchema(kind)
  if (loading) return <div style={{ opacity: 0.6 }}>loading schema {kind}…</div>
  if (error) return <div style={{ color: 'crimson' }}>schema error: {String(error.message || error)}</div>
  if (!schema) return null
  if (!entry || typeof entry !== 'object') return <div>no entry</div>

  const hideSet = new Set(hide)
  const declared = fieldOrder(schema)
  const declaredSet = new Set(declared)
  const extras = Object.keys(entry).filter((k) => !declaredSet.has(k) && !hideSet.has(k))
  const fields = [...declared, ...extras].filter((k) => !hideSet.has(k))

  const props = schema.properties || {}
  const required = new Set(schema.required || [])

  return (
    <div className="schema-card" style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      <header style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {schema.title || `kind: ${kind}`}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{entry.name || <em>unnamed</em>}</div>
        {entry.description && (
          <div style={{ opacity: 0.75, marginTop: 4 }}>{entry.description}</div>
        )}
      </header>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {fields.map((field) => {
            if (field === 'name' || field === 'description') return null // shown in header
            const def = props[field] || {}
            const isReq = required.has(field)
            const value = entry[field]
            const isDeclared = declaredSet.has(field)
            return (
              <tr key={field} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '4px 8px', verticalAlign: 'top', width: 160, opacity: isDeclared ? 1 : 0.55 }}>
                  <span style={{ fontWeight: isReq ? 600 : 400 }}>{field}</span>
                  {isReq && <sup style={{ color: 'crimson', marginLeft: 2 }}>*</sup>}
                  {!isDeclared && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>(undeclared)</span>}
                </td>
                <td style={{ padding: '4px 8px', verticalAlign: 'top' }}>
                  {formatValue(value)}
                  {!compact && def.description && (
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{def.description}</div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
