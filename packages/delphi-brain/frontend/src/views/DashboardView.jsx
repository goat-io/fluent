/**
 * DashboardView — platform health metrics computed from filtered repos.
 * Same data as Table/Graph, same filters apply.
 *
 * Datastore detection reads the catalog's own classification fields via
 * `lib/catalog/taxonomy.js` — never regex on entity names. Add a new
 * datastore-class service in the catalog → it appears here automatically.
 */
import { useMemo, useState } from 'react'
import { useGraph } from '../lib/catalog/Graph.js'
import { isDataStore, classify } from '../lib/catalog/taxonomy.js'
import { domainOf } from '../lib/badgeRegistry'

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em' }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? 'var(--text-heading)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data, colorFn, maxItems = 15, onSelectService }) {
  const [expanded, setExpanded] = useState(null)
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {data.slice(0, maxItems).map(d => {
        const isOpen = expanded === d.label
        return (
          <div key={d.label}>
            <div
              onClick={() => setExpanded(isOpen ? null : d.label)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', padding: '2px 0', borderRadius: 4,
                transition: 'background 120ms ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{
                fontSize: 10, color: 'var(--text-muted)', width: 10, flexShrink: 0, textAlign: 'center',
              }}>{isOpen ? '▼' : '▶'}</span>
              <span style={{
                fontSize: 11, color: isOpen ? 'var(--text-heading)' : 'var(--text-muted)',
                fontWeight: isOpen ? 600 : 400,
                width: 110, textAlign: 'right',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
              }}>{d.label}</span>
              <div style={{ flex: 1, height: 18, background: 'var(--surface-raised)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${(d.count / max) * 100}%`, height: '100%',
                  background: colorFn?.(d.label) ?? 'var(--accent)',
                  borderRadius: 4, minWidth: d.count > 0 ? 2 : 0,
                  transition: 'width 300ms ease',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28, textAlign: 'right', flexShrink: 0 }}>
                {d.count}
              </span>
            </div>
            {/* Drill-down: list of repos */}
            {isOpen && d.repos && (
              <div style={{
                marginLeft: 24, padding: '4px 0 8px',
                borderLeft: `2px solid ${colorFn?.(d.label) ?? 'var(--border)'}`,
                paddingLeft: 12,
              }}>
                {d.repos.map(repo => (
                  <div
                    key={repo.name}
                    onClick={(e) => { e.stopPropagation(); onSelectService?.({ id: repo.name, name: repo.name, domain: repo.domain }) }}
                    style={{
                      fontSize: 12, padding: '3px 6px', cursor: 'pointer', borderRadius: 4,
                      color: 'var(--accent)', transition: 'background 120ms ease',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontWeight: 500 }}>{repo.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{repo.domain}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 style={{
      fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
      letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, marginTop: 24,
    }}>{children}</h3>
  )
}

// Domain colours read via badgeRegistry → _instance/lib/domains.js.
const domainColor = (d) => domainOf(d).color ?? '#94A3B8'

const LANG_COLORS = {
  typescript: '#3178C6', java: '#B07219', python: '#3572A5',
  c: '#555555', 'c#': '#178600', go: '#00ADD8', rust: '#DEA584',
  kotlin: '#A97BFF', swift: '#F05138', shell: '#89E051', hcl: '#844FBA',
}

export default function DashboardView({ repos, isLoading, onSelectService }) {
  // The single graph cache shared across the whole app — used to look up
  // each dependency target's full entity (kind, category, service) when
  // computing the datastore section. No view-specific fetch.
  const { indexes } = useGraph()
  const entityIndex = indexes?.byName
  const stats = useMemo(() => {
    if (!repos?.length) return null

    const countWithRepos = (arr, key) => {
      const c = {}
      arr.forEach(r => {
        const v = r[key] || r.spec?.[key] || 'unknown'
        if (!c[v]) c[v] = { count: 0, repos: [] }
        c[v].count++
        c[v].repos.push({ name: r.name, domain: r.domain ?? r.spec?.domain ?? '' })
      })
      return Object.entries(c).map(([label, d]) => ({ label, count: d.count, repos: d.repos })).sort((a, b) => b.count - a.count)
    }

    const total = repos.length
    const production = repos.filter(r => r.lifecycle === 'production' || r.status === 'production').length
    const deprecated = repos.filter(r => r.lifecycle === 'deprecated').length
    const experimental = repos.filter(r => r.lifecycle === 'experimental').length

    // Security
    let criticalFindings = 0, highFindings = 0, reposWithFindings = 0
    let hardcodedSecrets = 0, missingAuth = 0
    repos.forEach(r => {
      const sec = r.spec?.security
      if (!sec) return
      if (sec.findings?.length || sec.hasHardcodedSecrets || sec.hasMissingAuth) reposWithFindings++
      if (sec.hasHardcodedSecrets) hardcodedSecrets++
      if (sec.hasMissingAuth) missingAuth++
      ;(sec.findings || []).forEach(f => {
        if (f.severity === 'critical') criticalFindings++
        if (f.severity === 'high') highFindings++
      })
    })

    // APIs
    const withApi = repos.filter(r => r.spec?.providesApis?.length > 0).length

    // Languages from tags
    const langGroups = {}
    repos.forEach(r => {
      const ri = { name: r.name, domain: r.domain ?? '' }
      ;(r.spec?.tags || []).forEach(t => {
        if (['typescript', 'java', 'python', 'c', 'c#', 'go', 'rust', 'kotlin', 'swift', 'shell', 'hcl'].includes(t)) {
          if (!langGroups[t]) langGroups[t] = { count: 0, repos: [] }
          langGroups[t].count++
          langGroups[t].repos.push(ri)
        }
      })
    })
    const languages = Object.entries(langGroups).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.count - a.count)

    // Datastores — read the catalog's own classification (no regex on names).
    // `isDataStore(entity)` from lib/catalog/taxonomy.js inspects:
    //   - explicit `tags: ['datastore']` opt-in (preferred)
    //   - kind:dataAsset
    //   - kind:service with category in {database,cache,message-broker,search,cdc}
    //   - kind:infra with service in {rds,aurora,dynamodb,elasticache,s3,firestore,sqs,...}
    //
    // Lookup target by name to read its full entity (graph index passed in
    // via `entityIndex`). If the dep target isn't in the graph we just skip
    // (link-rot is shown elsewhere, not here).
    const dbGroups = {}
    repos.forEach(r => {
      const ri = { name: r.name, domain: r.domain ?? '' }
      ;(r.spec?.dependsOn || []).forEach(dep => {
        if (!dep || typeof dep === 'string') return
        const target = entityIndex?.get(dep.target)
        if (!target || !isDataStore(target)) return
        // Group by classification (the catalog's own category/service field).
        // Each datastore appears under the catalog-declared label, no
        // hand-curated pretty names.
        const label = `${classify(target)}: ${target.name}`
        if (!dbGroups[label]) dbGroups[label] = { count: 0, repos: [] }
        if (!dbGroups[label].repos.find(x => x.name === ri.name)) {
          dbGroups[label].count++
          dbGroups[label].repos.push(ri)
        }
      })
    })
    const databases = Object.entries(dbGroups).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.count - a.count)

    // Deployment
    const cloudGroups = {}, computeGroups = {}
    repos.forEach(r => {
      const ri = { name: r.name, domain: r.domain ?? '' }
      const dep = r.spec?.deployment
      if (dep?.cloud) {
        if (!cloudGroups[dep.cloud]) cloudGroups[dep.cloud] = { count: 0, repos: [] }
        cloudGroups[dep.cloud].count++
        cloudGroups[dep.cloud].repos.push(ri)
      }
      if (dep?.compute) {
        if (!computeGroups[dep.compute]) computeGroups[dep.compute] = { count: 0, repos: [] }
        computeGroups[dep.compute].count++
        computeGroups[dep.compute].repos.push(ri)
      }
    })
    const clouds = Object.entries(cloudGroups).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.count - a.count)
    const computes = Object.entries(computeGroups).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.count - a.count)

    return {
      total, production, deprecated, experimental,
      domains: countWithRepos(repos, 'domain'),
      types: countWithRepos(repos, 'type'),
      teams: countWithRepos(repos, 'team'),
      languages, databases, clouds, computes,
      criticalFindings, highFindings, reposWithFindings,
      hardcodedSecrets, missingAuth, withApi,
    }
  }, [repos])

  if (isLoading || !stats) {
    return (
      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 90, borderRadius: 10 }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Top cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
        <StatCard label="Total Repos" value={stats.total} icon="📦" />
        <StatCard label="Production" value={stats.production} color="var(--status-success)" icon="●" sub={`${Math.round(stats.production / stats.total * 100)}% of total`} />
        <StatCard label="Deprecated" value={stats.deprecated} color="var(--status-warning)" icon="●" />
        <StatCard label="Experimental" value={stats.experimental} color="var(--status-info)" icon="●" />
        <StatCard label="API Specs" value={stats.withApi} icon="🔌" sub="with openapi.json" />
        <StatCard label="Security Issues" value={stats.criticalFindings + stats.highFindings} color="var(--status-danger)" icon="🔒"
          sub={`${stats.criticalFindings} critical · ${stats.highFindings} high`} />
        <StatCard label="Hardcoded Secrets" value={stats.hardcodedSecrets} color="var(--status-danger)" icon="🔑" />
        <StatCard label="Missing Auth" value={stats.missingAuth} color="var(--status-warning)" icon="🔓" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Left column */}
        <div>
          <SectionTitle>By Domain</SectionTitle>
          <BarChart onSelectService={onSelectService} data={stats.domains} colorFn={domainColor} />

          <SectionTitle>By Type</SectionTitle>
          <BarChart onSelectService={onSelectService} data={stats.types} colorFn={() => 'var(--accent)'} />

          <SectionTitle>By Team</SectionTitle>
          <BarChart onSelectService={onSelectService} data={stats.teams} colorFn={() => '#8B5CF6'} />
        </div>

        {/* Right column */}
        <div>
          <SectionTitle>Languages</SectionTitle>
          <BarChart onSelectService={onSelectService} data={stats.languages} colorFn={l => LANG_COLORS[l] ?? '#94A3B8'} />

          <SectionTitle>Databases</SectionTitle>
          <BarChart onSelectService={onSelectService} data={stats.databases} colorFn={l => ({
            'DynamoDB': '#FF9900', 'MongoDB': '#4DB33D', 'PostgreSQL': '#336791',
            'SQL Server': '#CC2927', 'Redis': '#DC382D', 'Firestore': '#FFCA28',
            'MariaDB': '#003545', 'OpenSearch': '#005EB8',
          }[l] ?? '#94A3B8')} />

          <SectionTitle>Cloud Providers</SectionTitle>
          <BarChart onSelectService={onSelectService} data={stats.clouds} colorFn={() => '#FF9900'} />

          <SectionTitle>Compute</SectionTitle>
          <BarChart onSelectService={onSelectService} data={stats.computes} colorFn={() => '#4CAF50'} />
        </div>
      </div>
    </div>
  )
}
