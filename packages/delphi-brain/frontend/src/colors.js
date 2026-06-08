/**
 * Brand / palette tokens. Lifted out of App.jsx so any module can import
 * without creating a circular dependency.
 *
 * Generic Brain has no opinion on colours; the values here are a default
 * palette. A company-specific extraction would replace this file.
 */
export const C = {
  teal: '#007A6E', gold: '#D4A853', green: '#4CAF50', blue: '#3B82F6',
  orange: '#F5913E', pink: '#E84393', red: '#EF4444', cyan: '#00A99D', aws: '#FF9900',
  purple: '#8B5CF6',
}

export const domainColors = {
  icc: C.blue,
  ico: C.red,
  iot: C.green,
  apps: C.orange,
  identity: C.purple,
}
