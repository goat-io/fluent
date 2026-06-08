import { Handle, Position } from '@xyflow/react'
import { resolveLogo } from './logos'

/* ── Shared icon container — supports SVG children or image URL ── */
const Ic = ({ children, bg = 'rgba(0,122,110,.08)', color = '#007A6E', src, size = 30, iconSize = 20 }) => (
  <div style={{
    width: size, height: size, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: bg, color, flexShrink: 0, overflow: 'hidden',
  }}>
    {src ? <img src={resolveLogo(src)} alt="" style={{ width: iconSize, height: iconSize, objectFit: 'contain' }} /> : children}
  </div>
)

/* ── Device Node (output right only) ── */
export function DeviceNode({ data }) {
  return (
    <div style={{
      background: '#fff', border: '1.5px solid rgba(0,122,110,.18)', borderRadius: 10,
      padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 155,
      boxShadow: '0 1px 4px rgba(0,0,0,.04)', fontFamily: 'Inter, sans-serif',
    }}>
      <Ic>{data.icon}</Ic>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1A202C' }}>{data.label}</div>
        <div style={{ fontSize: 9, color: '#A3B1BC', marginTop: 1 }}>{data.description}</div>
      </div>
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8, background: '#007A6E', border: 'none' }} />
    </div>
  )
}

/* ── Service Node (generic, input left + output right) ── */
export function ServiceNode({ data }) {
  const borderColor = data.borderColor || 'rgba(148,163,184,.2)'
  const accentColor = data.accentColor || '#4A5568'
  const iconBg = data.iconBg || 'rgba(148,163,184,.08)'
  // Split description on \n for multi-line rendering
  const descLines = data.description ? data.description.split('\n').filter(Boolean) : []
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${borderColor}`, borderRadius: 10,
      padding: '6px 12px', display: 'flex', alignItems: 'flex-start', gap: 7, width: 200, maxWidth: 200,
      boxShadow: '0 1px 4px rgba(0,0,0,.04)', fontFamily: 'Inter, sans-serif',
      position: 'relative',
    }}>
      {data.hasInput !== false && (
        <Handle type="target" position={Position.Left} style={{ width: 8, height: 8, background: accentColor, border: 'none' }} />
      )}
      <Ic bg={iconBg} color={accentColor} src={data.logoUrl}>{data.icon}</Ic>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: accentColor, lineHeight: 1.2 }}>{data.label}</div>
        {descLines.map((line, i) => (
          <div key={i} style={{ fontSize: 8, color: line.includes('⚠') ? '#EF4444' : '#A3B1BC', marginTop: i === 0 ? 2 : 0, lineHeight: 1.3 }}>{line}</div>
        ))}
        {/* AZ + Scale badges */}
        {(data.azs || data.scale) && (
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            {data.azs && (
              <span style={{
                fontSize: 7, fontWeight: 700, color: '#fff', background: accentColor,
                padding: '1px 5px', borderRadius: 4, letterSpacing: '.02em',
              }}>{data.azs} AZ</span>
            )}
            {data.scale && (
              <span style={{
                fontSize: 7, fontWeight: 700, color: accentColor,
                background: `${accentColor}15`, border: `1px solid ${accentColor}30`,
                padding: '1px 5px', borderRadius: 4, letterSpacing: '.02em',
              }}>×{data.scale}</span>
            )}
            {data.managed && (
              <span style={{
                fontSize: 7, fontWeight: 700, color: '#FF9900',
                background: 'rgba(255,153,0,.08)', border: '1px solid rgba(255,153,0,.2)',
                padding: '1px 5px', borderRadius: 4,
              }}>Managed</span>
            )}
          </div>
        )}
      </div>
      {data.hasOutput !== false && (
        <Handle type="source" position={Position.Right} style={{ width: 8, height: 8, background: accentColor, border: 'none' }} />
      )}
      {data.hasOutputBottom && (
        <Handle type="source" position={Position.Bottom} id="bottom" style={{ width: 8, height: 8, background: accentColor, border: 'none' }} />
      )}
      {data.hasInputTop && (
        <Handle type="target" position={Position.Top} id="top" style={{ width: 8, height: 8, background: accentColor, border: 'none' }} />
      )}
      {data.hasInputBottom && (
        <Handle type="target" position={Position.Bottom} id="bottom" style={{ width: 8, height: 8, background: accentColor, border: 'none' }} />
      )}
      {data.hasOutputTop && (
        <Handle type="source" position={Position.Top} id="top" style={{ width: 8, height: 8, background: accentColor, border: 'none' }} />
      )}
      {data.hasInputRight && (
        <Handle type="target" position={Position.Right} id="right" style={{ width: 8, height: 8, background: accentColor, border: 'none' }} />
      )}
    </div>
  )
}

/* ── Core Broker Node ── */
export function CoreNode() {
  return (
    <div style={{ width: 180, height: 180, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8, background: '#00A99D', border: 'none' }} />
      <Handle type="target" position={Position.Right} id="right-in" style={{ width: 8, height: 8, background: '#00A99D', border: 'none', top: '35%' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ width: 8, height: 8, background: '#00A99D', border: 'none', top: '65%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-left" style={{ width: 8, height: 8, background: '#EF4444', border: 'none', left: '35%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-right" style={{ width: 8, height: 8, background: '#3B82F6', border: 'none', left: '65%' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(0,169,157,.15)' }} />
      <div style={{
        position: 'absolute', inset: -2, borderRadius: '50%',
        border: '2px solid transparent', borderTopColor: '#00A99D',
        animation: 'spin 6s linear infinite',
      }} />
      <div style={{
        width: 140, height: 140, borderRadius: '50%', background: '#fff',
        border: '1.5px solid rgba(0,169,157,.2)', boxShadow: '0 4px 20px rgba(0,122,110,.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, zIndex: 1,
      }}>
        <img src={resolveLogo('/logos/emqx.svg')} alt="EMQX" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#007A6E', fontFamily: 'Inter' }}>EMQX</div>
        <div style={{ fontSize: 7, color: '#A3B1BC', fontFamily: 'Inter' }}>MQTT Broker (swappable)</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ── Label Node (for section headings) ── */
export function LabelNode({ data }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: data.color || '#A3B1BC',
      fontFamily: 'Inter', letterSpacing: '.05em', textTransform: 'uppercase',
      padding: '4px 8px', background: 'rgba(248,250,251,.8)', borderRadius: 6,
    }}>
      {data.label}
    </div>
  )
}

/* ── Zone Node (colored background lane) ── */
export function ZoneNode({ data }) {
  return (
    <div style={{
      width: data.width || 220, height: data.height || 400,
      background: data.bg || 'rgba(0,122,110,.03)',
      border: `1.5px solid ${data.borderColor || 'rgba(0,122,110,.08)'}`,
      borderRadius: 16,
      padding: '12px 16px',
      fontFamily: 'Inter, sans-serif',
      pointerEvents: 'none',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: data.labelColor || '#A3B1BC',
        letterSpacing: '.06em', textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {data.label}
      </div>
      {data.sublabel && (
        <div style={{ fontSize: 8, color: data.labelColor || '#A3B1BC', opacity: 0.6 }}>
          {data.sublabel}
        </div>
      )}
    </div>
  )
}

/* ── Canvas Block Node (for Business Model Canvas) ── */
export function CanvasBlockNode({ data }) {
  const items = data.items || []
  return (
    <div style={{
      width: data.width || 280,
      height: data.height || undefined,
      minHeight: data.minHeight || 100,
      background: data.bg || '#fff',
      border: `2px solid ${data.borderColor || '#E2E8F0'}`,
      borderRadius: 12,
      padding: '14px 16px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: data.color || '#1A202C',
        letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10,
        paddingBottom: 6, borderBottom: `1.5px solid ${data.borderColor || '#E2E8F0'}`,
      }}>
        {data.icon && <span style={{ marginRight: 6 }}>{data.icon}</span>}
        {data.label}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#1A202C', lineHeight: 1.3 }}>{item.title}</div>
          <div style={{ fontSize: 8, color: '#94A3B8', lineHeight: 1.3, marginTop: 1 }}>{item.desc}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Swim Lane Node (horizontal team band) ── */
export function SwimLaneNode({ data }) {
  return (
    <div style={{
      width: data.width || 1500, height: data.height || 180,
      background: data.bg || 'rgba(0,0,0,.01)',
      borderTop: `1px dashed ${data.color || '#CBD5E1'}`,
      borderBottom: `1px dashed ${data.color || '#CBD5E1'}`,
      pointerEvents: 'none',
      position: 'relative',
    }}>
      {/* Team label on right edge, outside the lane */}
      <div style={{
        position: 'absolute', right: -110, top: '50%', transform: 'translateY(-50%)',
        width: 100, textAlign: 'left',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: data.color || '#94A3B8', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {data.label}
        </div>
        {data.sublabel && (
          <div style={{ fontSize: 8, color: data.color || '#94A3B8', opacity: 0.6, marginTop: 2 }}>
            {data.sublabel}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Layer Divider Node (vertical architecture layer line) ── */
export function LayerDividerNode({ data }) {
  return (
    <div style={{
      width: 1, height: data.height || 600,
      borderLeft: `1.5px dashed ${data.color || '#E2E8F0'}`,
      pointerEvents: 'none',
      position: 'relative',
    }}>
      {/* Layer label at top */}
      <div style={{
        position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
        fontSize: 8, fontWeight: 600, color: data.color || '#94A3B8',
        letterSpacing: '.06em', textTransform: 'uppercase',
        background: '#FAFBFC', padding: '2px 8px', borderRadius: 4,
      }}>
        {data.label}
      </div>
    </div>
  )
}

/* ── Database Node ── */
const dbTypeColors = {
  'MongoDB': '#4DB33D',
  'SQL Server': '#CC2927',
  'PostgreSQL': '#336791',
  'Aurora PostgreSQL': '#336791',
  'DynamoDB': '#4053D6',
  'Firestore': '#FFCA28',
  'MariaDB': '#003545',
  'OpenSearch': '#005EB8',
  'Redis': '#DC382D',
}

export function DatabaseNode({ data }) {
  const typeColor = dbTypeColors[data.dbType] || '#6B7280'
  const borderColor = data.critical ? '#EF4444' : `${typeColor}44`
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${borderColor}`, borderRadius: 10,
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 170,
      boxShadow: data.critical ? '0 0 8px rgba(239,68,68,.15)' : '0 1px 4px rgba(0,0,0,.04)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8, background: typeColor, border: 'none' }} />
      <div style={{
        width: 28, height: 28, borderRadius: 6, background: `${typeColor}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={typeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M3 5v14a9 3 0 0018 0V5"/>
          <path d="M3 12a9 3 0 0018 0"/>
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#1A202C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.label}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 7, fontWeight: 700, color: '#fff', background: typeColor,
            padding: '1px 5px', borderRadius: 4,
          }}>{data.dbType}</span>
          <span style={{
            fontSize: 7, fontWeight: 600, color: '#6B7280',
            background: '#F3F4F6', padding: '1px 5px', borderRadius: 4,
          }}>{data.hosting}</span>
        </div>
        {data.description && <div style={{ fontSize: 8, color: '#A3B1BC', marginTop: 2 }}>{data.description}</div>}
      </div>
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8, background: typeColor, border: 'none' }} />
    </div>
  )
}

/* ── Persona Node ── */
const personaIcons = {
  headset: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>,
  heart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  briefcase: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
}

export function PersonaNode({ data }) {
  const color = data.color || '#6366F1'
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${color}33`, borderRadius: 12,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 180,
      boxShadow: '0 1px 4px rgba(0,0,0,.04)', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', background: `${color}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0,
      }}>
        {personaIcons[data.icon] || personaIcons.user}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A202C' }}>{data.label}</div>
        <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>{data.description}</div>
        <div style={{
          fontSize: 8, fontWeight: 600, color, marginTop: 3,
          background: `${color}08`, padding: '1px 6px', borderRadius: 4, display: 'inline-block',
        }}>{data.system}</div>
      </div>
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8, background: color, border: 'none' }} />
    </div>
  )
}

/* ── Step Node (for alarm flows) ── */
export function StepNode({ data }) {
  const color = data.color || '#6366F1'
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${color}33`, borderRadius: 10,
      padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 220, maxWidth: 320,
      boxShadow: '0 1px 4px rgba(0,0,0,.04)', fontFamily: 'Inter, sans-serif',
    }}>
      <Handle type="target" position={Position.Top} style={{ width: 8, height: 8, background: color, border: 'none' }} />
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontSize: 10, fontWeight: 700, color: '#fff',
      }}>
        {data.step}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#1A202C' }}>{data.action}</div>
        {data.service && <div style={{ fontSize: 8, color: '#6B7280', marginTop: 2 }}>{data.service}</div>}
        {data.protocol && (
          <span style={{
            fontSize: 7, fontWeight: 700, color, marginTop: 3,
            background: `${color}12`, padding: '1px 6px', borderRadius: 4, display: 'inline-block',
          }}>{data.protocol}</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8, background: color, border: 'none' }} />
    </div>
  )
}

/* ── Infra Node (for infrastructure view) ── */
export function InfraNode({ data }) {
  const color = data.color || '#6B7280'
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${color}33`, borderRadius: 10,
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 160,
      boxShadow: '0 1px 4px rgba(0,0,0,.04)', fontFamily: 'Inter, sans-serif',
    }}>
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8, background: color, border: 'none' }} />
      <div style={{
        width: 26, height: 26, borderRadius: 6, background: `${color}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2"/>
          <rect x="2" y="14" width="20" height="8" rx="2"/>
          <line x1="6" y1="6" x2="6.01" y2="6"/>
          <line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#1A202C' }}>{data.label}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          <span style={{
            fontSize: 7, fontWeight: 700, color: '#fff', background: color,
            padding: '1px 5px', borderRadius: 4,
          }}>{data.type}</span>
        </div>
        {data.description && <div style={{ fontSize: 8, color: '#A3B1BC', marginTop: 2 }}>{data.description}</div>}
      </div>
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8, background: color, border: 'none' }} />
    </div>
  )
}
