import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useQueryState, parseAsString } from 'nuqs'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchCatalogEntry, fetchEntityContributors, fetchConfig } from '../api'
import { useArch, findConnectionsFor, findDatabasesFor } from '../data/ArchProvider.jsx'
import { StatusBadge, DomainBadge } from '../lib/Badges.jsx'
import Section from '../lib/Section.jsx'
import Pill from '../lib/Pill.jsx'
import { useGraph } from '../lib/catalog/Graph.js'

// Source-control base URLs are company-specific. They come from the backend's
// `GET /api/config` ({ org: { sourceBaseUrl, catalogRepoUrl } }). When unset we
// render no external link rather than pointing at a hardcoded company.
function useInstanceLinks() {
  const [links, setLinks] = useState({ sourceBaseUrl: null, catalogRepoUrl: null })
  useEffect(() => {
    let cancelled = false
    fetchConfig().then((cfg) => {
      if (cancelled || !cfg?.org) return
      setLinks({
        sourceBaseUrl: cfg.org.sourceBaseUrl || null,
        catalogRepoUrl: cfg.org.catalogRepoUrl || null,
      })
    })
    return () => { cancelled = true }
  }, [])
  return links
}

function MetaRow({ label, value, mono, link, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      fontSize: 13, marginBottom: 5, gap: 12,
    }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      {link
        ? <a href={link} target="_blank" rel="noopener noreferrer" style={{
            color: 'var(--accent)', textDecoration: 'none', textAlign: 'right',
            fontFamily: mono ? 'var(--font-mono)' : undefined,
            fontSize: mono ? 11 : 13,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%',
          }}>{value}</a>
        : <span style={{
            color: color ?? 'var(--text)', fontWeight: 500, textAlign: 'right',
            fontFamily: mono ? 'var(--font-mono)' : undefined,
            fontSize: mono ? 11 : 13,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%',
          }}>{value}</span>
      }
    </div>
  )
}

function stripFrontmatter(content) {
  if (!content) return ''
  return content.replace(/^---[\s\S]*?---\n*/m, '')
}

const tabStyle = (active) => ({
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--accent)' : 'var(--text-muted)',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  cursor: 'pointer',
  transition: 'all 120ms ease',
})

function DrawerTabs({ svc, nodeId, conns, dbs, svcFindings, catalogPath, catalogData, catalogLoading, directOwnerTeams, transitiveTeams, contributors, onNavigate }) {
  // Tab in URL — `?tab=overview|analysis|api|deps|team`. Default `overview`
  // is implicit (URL stays clean until user picks another tab).
  const [tabParam, setTabParam] = useQueryState('tab', parseAsString)
  const setTab = (t) => setTabParam(t === 'overview' ? null : t)

  // Fetch linked api entities for entries that declare `providesApis`. These
  // may carry an `openapi` (REST) OR an `operations` list (JMS/AMQP message
  // contracts). The catalog stores them as separate `kind: api` entries under
  // catalog/apis/<name>/, so we fetch each in parallel.
  const providedApiNames = useMemo(() => {
    const raw = catalogData?.spec?.providesApis ?? svc?.spec?.providesApis ?? []
    return raw
      .map((a) => (typeof a === 'string' ? a : a?.target))
      .filter(Boolean)
  }, [catalogData, svc])

  const linkedApiQueries = useQuery({
    queryKey: ['linkedApis', providedApiNames.join(',')],
    queryFn: async () => {
      if (providedApiNames.length === 0) return []
      const results = await Promise.all(
        providedApiNames.map((name) => fetchCatalogEntry('apis', name).catch(() => null))
      )
      return results.filter(Boolean)
    },
    enabled: providedApiNames.length > 0,
    staleTime: 60_000,
  })
  const linkedApis = linkedApiQueries.data ?? []

  // API tab opens when either the repo itself has an openapi.json OR any
  // linked api entity has openapi/operations.
  const apiTabHasContent = !!(
    catalogData?.openapi ||
    linkedApis.some((a) => a?.openapi || (a?.spec?.operations?.length > 0))
  )

  // Fall back to overview when the URL points at a tab the current entry
  // doesn't expose (e.g. switching to an entry without an openapi).
  const requested = tabParam || 'overview'
  const tabAvailable = (
    requested === 'overview' ||
    requested === 'analysis' ||
    (requested === 'api'  && apiTabHasContent) ||
    (requested === 'deps' && conns.length > 0) ||
    (requested === 'team' && ((catalogData?.spec?.collaborators?.length > 0) || (contributors?.totalContributors > 0)))
  )
  const tab = tabAvailable ? requested : 'overview'

  return (
    <>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        flexShrink: 0,
      }}>
        <button style={tabStyle(tab === 'overview')} onClick={() => setTab('overview')}>Overview</button>
        <button style={tabStyle(tab === 'analysis')} onClick={() => setTab('analysis')}>
          Analysis {catalogLoading ? '...' : ''}
        </button>
        {apiTabHasContent && (
          <button style={tabStyle(tab === 'api')} onClick={() => setTab('api')}>
            API{linkedApis.length > 1 ? ` (${linkedApis.length})` : ''}
          </button>
        )}
        {conns.length > 0 && (
          <button style={tabStyle(tab === 'deps')} onClick={() => setTab('deps')}>
            Dependencies ({conns.length})
          </button>
        )}
        {((catalogData?.spec?.collaborators?.length > 0) || (contributors?.totalContributors > 0)) && (
          <button style={tabStyle(tab === 'team')} onClick={() => setTab('team')}>
            People ({contributors?.totalContributors ?? catalogData?.spec?.collaborators?.length ?? 0})
          </button>
        )}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {tab === 'overview' && (
          <OverviewTab svc={svc} nodeId={nodeId} conns={conns} dbs={dbs} directOwnerTeams={directOwnerTeams} transitiveTeams={transitiveTeams} contributors={contributors} onNavigate={onNavigate}
            svcFindings={svcFindings} catalogPath={catalogPath} catalogData={catalogData} />
        )}
        {tab === 'analysis' && (
          <ReadmeTab catalogData={catalogData} catalogLoading={catalogLoading} catalogPath={catalogPath} />
        )}
        {tab === 'api' && apiTabHasContent && (
          <ApiTabMulti
            ownOpenapi={catalogData?.openapi}
            linkedApis={linkedApis}
            onNavigate={onNavigate}
          />
        )}
        {tab === 'deps' && (
          <DepsTab nodeId={nodeId} conns={conns} dbs={dbs} />
        )}
        {tab === 'team' && (
          <TeamTab
            collaborators={catalogData?.spec?.collaborators}
            contributors={contributors}
          />
        )}
      </div>
    </>
  )
}

/**
 * Transitive contributors — everyone who's ever touched any repo reachable
 * from the current entity. Reads `spec.collaborators` from each reachable
 * repo, aggregates by GitHub login, ranks by total commits across the set.
 *
 * Render: GitHub avatar grid (40 px) with commit total, hover for the
 * per-repo breakdown. Top 20 visible by default; "show all" expands.
 */
/**
 * Transitive contributors row — one expandable card per person.
 * Sorted by proximity to the current entity; per-person the repo list is
 * ALSO sorted by proximity so the closest repo (where their work most
 * directly impacts this entity) shows first.
 */
// ApiChip — renders one element of providesApis / consumesApis. Tolerates
// both shapes: a bare string (legacy) or `{target, kind, operation?}` (post
// Phase 1.3). When `target` resolves we make the chip clickable so the
// drawer navigates straight to the api entry.
function ApiChip({ api, tone, onNavigate }) {
  const isObj = api && typeof api === 'object'
  const target = isObj ? api.target : api
  const operation = isObj ? api.operation : null
  const clickable = !!target && !!onNavigate
  const palette = tone === 'success'
    ? { bg: 'hsl(142 71% 45% / 0.08)', fg: 'var(--status-success)', border: 'hsl(142 71% 45% / 0.2)' }
    : { bg: 'var(--surface-raised)', fg: 'var(--text-muted)', border: 'var(--border)' }
  return (
    <span
      onClick={clickable ? () => onNavigate(target) : undefined}
      title={operation ? `via ${target} · ${operation}` : target}
      style={{
        fontSize: 11, padding: '3px 10px', borderRadius: 6,
        background: palette.bg, color: palette.fg,
        border: `1px solid ${palette.border}`, fontFamily: 'var(--font-mono)',
        cursor: clickable ? 'pointer' : 'default',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
      <span>{target}</span>
      {operation && operation !== target && (
        <span style={{ fontSize: 10, opacity: 0.7 }}>· {operation}</span>
      )}
    </span>
  )
}

function ContributorRow({ person, closestRepoName, compact }) {
  const [open, setOpen] = useState(false)
  const inGroup = !!closestRepoName
  const inGroupRepo = inGroup ? person.repos.find(r => r.name === closestRepoName) : null
  const closest = person.repos[0]
  // Compact variant for inside a RepoGroup — single line, smaller avatar,
  // role pill on the right. The grouped header already tells you which
  // repo this person is closest to, so don't repeat it.
  if (compact) {
    const role = inGroupRepo?.role || 'contributor'
    const roleColor = role === 'owner' ? '#16A34A' : role === 'maintainer' ? '#3B82F6' : '#64748B'
    return (
      <>
        <div onClick={() => setOpen(o => !o)}
             style={{
               display: 'grid',
               gridTemplateColumns: '24px 1fr auto auto',
               alignItems: 'center', gap: 8,
               padding: '4px 6px', borderRadius: 4,
               cursor: 'pointer',
             }}
             onMouseEnter={e => e.currentTarget.style.background = 'var(--background)'}
             onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <img src={`https://github.com/${person.login}.png?size=48`} alt={person.login}
               width={24} height={24}
               style={{ borderRadius: '50%', flexShrink: 0,
                        opacity: person.recentlyActive ? 1 : 0.55,
                        border: person.topRole === 'owner' ? '2px solid #16A34A'
                              : person.topRole === 'maintainer' ? '2px solid #3B82F6'
                              : '1px solid var(--border)' }} />
          <a href={`https://github.com/${person.login}`} target="_blank" rel="noopener noreferrer"
             onClick={e => e.stopPropagation()}
             style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)',
                      textDecoration: 'none', minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.login}
          </a>
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
            background: `${roleColor}18`, color: roleColor,
            border: `1px solid ${roleColor}33`,
            fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>{role}</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                         minWidth: 80, textAlign: 'right' }}>
            {(inGroupRepo?.commits || 0).toLocaleString()}
            {person.repos.length > 1 && (
              <span style={{ opacity: 0.5 }}> · +{person.repos.length - 1}</span>
            )}
          </span>
        </div>
        {open && person.repos.length > 1 && (
          <div style={{ marginLeft: 38, paddingLeft: 8, borderLeft: '1px dashed var(--border)',
                        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                        marginBottom: 4 }}>
            {person.repos.filter(r => r.name !== closestRepoName).map(r => (
              <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name} <span style={{ opacity: 0.6 }}>· +{r.depth}</span>
                </span>
                <span>{r.commits.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  // Standalone (non-grouped) variant — same as before.
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 6,
      background: 'var(--surface)', overflow: 'hidden',
    }}>
      <div onClick={() => setOpen(o => !o)}
           style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', cursor: 'pointer' }}>
        <img src={`https://github.com/${person.login}.png?size=64`} alt={person.login}
             width={32} height={32}
             style={{ borderRadius: '50%', flexShrink: 0,
                      opacity: person.recentlyActive ? 1 : 0.55,
                      border: person.topRole === 'owner' ? '2px solid #16A34A'
                            : person.topRole === 'maintainer' ? '2px solid #3B82F6'
                            : '1px solid var(--border)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <a href={`https://github.com/${person.login}`} target="_blank" rel="noopener noreferrer"
               onClick={e => e.stopPropagation()}
               style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none', fontSize: 13 }}>
              {person.login}
            </a>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {person.totalCommits.toLocaleString()} commits · {person.repos.length} repo{person.repos.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            closest: {closest.name} ({closest.commits} commits, {closest.role || '—'})
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px',
                      fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {person.repos.map(r => (
            <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between',
                                       padding: '3px 0', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text)' }}>
                {r.name} <span style={{ color: 'var(--text-muted)' }}>· {r.role || 'contributor'}</span>
              </span>
              <span>{r.commits.toLocaleString()} commits · depth {r.depth}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Repo group — one collapsible group per repo, contains every contributor
 * whose closest reach to the current entity is via that repo. Closer-depth
 * groups render first; within a group people are ordered by their commit
 * count to that specific repo.
 */
function RepoGroup({ repoName, depth, people }) {
  const [open, setOpen] = useState(depth <= 1) // direct + 1-hop expand by default
  const totalCommits = people.reduce((s, p) => {
    const r = p.repos.find(x => x.name === repoName)
    return s + (r?.commits || 0)
  }, 0)
  // Depth → distinct accent so the eye scans by proximity at a glance.
  const depthColor = depth === 0 ? '#16A34A' : depth === 1 ? '#3B82F6' : depth === 2 ? '#8B5CF6' : '#94A3B8'
  return (
    <div style={{ borderRadius: 6, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
           style={{
             display: 'grid',
             gridTemplateColumns: '14px 1fr auto',
             alignItems: 'center', gap: 10, width: '100%',
             padding: '7px 12px', cursor: 'pointer',
             background: open ? 'var(--background)' : 'var(--surface)',
             border: '1px solid var(--border)',
             borderLeft: `3px solid ${depthColor}`,
             borderRadius: open ? '6px 6px 0 0' : 6,
             borderBottom: open ? 'none' : '1px solid var(--border)',
             textAlign: 'left',
           }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
        <span style={{
          minWidth: 0, fontFamily: 'var(--font-mono)',
          fontSize: 12, fontWeight: 600, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={repoName}>{repoName}</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10,
                       fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          <span style={{ color: depthColor, fontWeight: 600 }}>
            {depth === 0 ? 'direct' : `+${depth}`}
          </span>
          <span>{people.length}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{totalCommits.toLocaleString()}</span>
        </span>
      </button>
      {open && (
        <div style={{
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderLeft: `3px solid ${depthColor}`,
          borderRadius: '0 0 6px 6px',
          padding: '4px 6px',
          display: 'flex', flexDirection: 'column', gap: 3,
          background: 'var(--surface)',
        }}>
          {people.map(p => <ContributorRow key={p.login} person={p} closestRepoName={repoName} compact />)}
        </div>
      )}
    </div>
  )
}

function CollaboratorsSection({ people, title }) {
  const totalCommits = people.reduce((s, p) => s + p.totalCommits, 0)
  // Bucket people by their closest repo (already sorted closest-first per
  // person, so repos[0] is the proximity anchor).
  const groups = useMemo(() => {
    const m = new Map() // repoName → { repoName, depth, people[] }
    for (const p of people) {
      const closest = p.repos[0]
      if (!closest) continue
      const key = closest.name
      if (!m.has(key)) m.set(key, { repoName: key, depth: closest.depth, people: [] })
      m.get(key).people.push(p)
    }
    // Sort: closer depth first, then more contributors
    const arr = [...m.values()]
    for (const g of arr) g.people.sort((a, b) => {
      const ar = a.repos.find(r => r.name === g.repoName)?.commits || 0
      const br = b.repos.find(r => r.name === g.repoName)?.commits || 0
      return br - ar
    })
    arr.sort((a, b) => a.depth - b.depth || b.people.length - a.people.length)
    return arr
  }, [people])
  return (
    <Section title={title || `Reachable contributors (${people.length} · ${totalCommits.toLocaleString()} commits)`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map(g => <RepoGroup key={g.repoName} {...g} />)}
      </div>
    </Section>
  )
}

function OverviewTab({ svc, nodeId, conns, dbs, svcFindings, catalogPath, catalogData, directOwnerTeams, transitiveTeams, contributors, onNavigate }) {
  const { sourceBaseUrl, catalogRepoUrl } = useInstanceLinks()
  const repoLink = sourceBaseUrl && svc.repo ? `${sourceBaseUrl}/${svc.repo}` : null
  const catalogLink = catalogRepoUrl && catalogPath
    ? `${catalogRepoUrl}/blob/main/engineering/catalog/${catalogPath}`
    : null
  return (
    <>
      {svc.description && (
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
          {svc.description}
        </p>
      )}
      {svc.note && (
        <div style={{
          fontSize: 12, color: 'var(--status-danger)',
          background: 'hsl(0 84% 60% / 0.1)',
          border: '1px solid hsl(0 84% 60% / 0.3)',
          borderRadius: 8, padding: '10px 12px', marginBottom: 20, lineHeight: 1.5,
        }}>
          ⚠ {svc.note}
        </div>
      )}
      {/* Transitive teams — every team reached by walking down the
          dependency graph from this entity. Answers "if I depend on Eliza,
          which teams will I end up coordinating with?" without manual
          click-through. */}
      {transitiveTeams && transitiveTeams.length > 0 && (
        <Section title={`Indirect teams (via dependencies · ${transitiveTeams.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {transitiveTeams.map(t => (
              <span key={t.slug}
                    title={`${t.contributors.length} entities owned by ${t.name}: ${t.contributors.slice(0, 8).join(', ')}${t.contributors.length > 8 ? '…' : ''}`}
                    style={{ cursor: 'help' }}>
                <Pill label={`${t.name} (${t.contributors.length})`} color="#EC4899" />
              </span>
            ))}
          </div>
        </Section>
      )}
      <Section title="Details">
        {(() => {
          // Direct team (repo with `team` string) → show as-is.
          // Otherwise derive primary owner from the most-contributing
          // transitive team. Covers kind:product / kind:system / etc. that
          // don't carry their own team field but are owned via children.
          const directTeam = svc.team && svc.team !== '—' ? svc.team : null
          // For products / systems / etc. with no team field, derive from
          // componentRepos owners — NOT the full transitive walk (which
          // includes downstream backends and over-counts unrelated teams).
          const derivedTeam = !directTeam && directOwnerTeams?.[0]
            ? `${directOwnerTeams[0].name} (derived — owns ${directOwnerTeams[0].contributors.length} component${directOwnerTeams[0].contributors.length === 1 ? '' : 's'})`
            : null
          const teamLabel = directTeam || derivedTeam
          return teamLabel && <MetaRow label="Team" value={teamLabel} />
        })()}
        {svc.hosting && svc.hosting !== '—' && <MetaRow label="Hosting"  value={svc.hosting} />}
        {svc.tech    && svc.tech !== '—'    && <MetaRow label="Tech"     value={svc.tech} mono />}
        {svc.port    && <MetaRow label="Port"     value={svc.port} mono />}
        {svc.loc     && <MetaRow label="LOC"      value={svc.loc} />}
        {svc.firmware && <MetaRow label="Firmware" value={svc.firmware} mono />}
        {catalogData?.metadata?.last_updated && (
          <MetaRow label="Last updated" value={catalogData.metadata.last_updated} />
        )}
        {svc.repo && (
          <MetaRow label="Repository" value={svc.repo} link={repoLink ?? undefined} mono />
        )}
        {svc.repoUrl && !svc.repo && (
          <MetaRow label="Repository" value={svc.name} link={svc.repoUrl} mono />
        )}
      </Section>
      {/* Dependencies from catalog-info.json spec — grouped by kind */}
      {(() => {
        const rawDeps = catalogData?.spec?.dependsOn ?? svc?.spec?.dependsOn ?? []
        const provides = catalogData?.spec?.providesApis ?? svc?.spec?.providesApis ?? []
        const consumes = catalogData?.spec?.consumesApis ?? svc?.spec?.consumesApis ?? []

        // Catalog v2: deps are objects {target, kind, protocol, port, purpose}.
        // Tolerate stale string entries by coercing them.
        const deps = rawDeps.map(d => typeof d === 'string'
          ? { target: d.replace(/^(infra|external):/, ''), kind: d.startsWith('infra:') ? 'infra' : d.startsWith('external:') ? 'external' : 'repo' }
          : d
        )

        if (deps.length === 0 && provides.length === 0 && consumes.length === 0) return null

        // Group deps by kind
        const repoDeps = deps.filter(d => (d.kind ?? 'repo') === 'repo' || (d.kind ?? 'repo') === 'service')
        const infra = deps.filter(d => d.kind === 'infra')
        const external = deps.filter(d => d.kind === 'external')

        const DepChip = ({ dep, clickable }) => (
          <span
            onClick={clickable ? () => onNavigate?.(dep.target) : undefined}
            title={[dep.protocol, dep.port ? `:${dep.port}` : '', dep.purpose ? ` — ${dep.purpose}` : ''].join('')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '3px 10px', borderRadius: 6,
              background: clickable ? 'var(--accent)08' : 'var(--surface-raised)',
              color: clickable ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${clickable ? 'var(--accent)20' : 'var(--border)'}`,
              cursor: clickable ? 'pointer' : 'default',
              fontWeight: 500, transition: 'all 120ms ease',
            }}
            onMouseEnter={clickable ? e => { e.currentTarget.style.background = 'var(--accent)18' } : undefined}
            onMouseLeave={clickable ? e => { e.currentTarget.style.background = 'var(--accent)08' } : undefined}
          >
            {dep.target}
            {dep.protocol && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {dep.protocol}{dep.port ? `:${dep.port}` : ''}
              </span>
            )}
          </span>
        )

        return (
          <>
            {repoDeps.length > 0 && (
              <Section title={`Service Dependencies (${repoDeps.length})`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {repoDeps.map((dep, i) => <DepChip key={i} dep={dep} clickable />)}
                </div>
              </Section>
            )}
            {infra.length > 0 && (
              <Section title={`Infrastructure (${infra.length})`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {infra.map((dep, i) => <DepChip key={i} dep={dep} clickable />)}
                </div>
              </Section>
            )}
            {external.length > 0 && (
              <Section title={`External Services (${external.length})`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {external.map((dep, i) => <DepChip key={i} dep={dep} clickable />)}
                </div>
              </Section>
            )}
            {provides.length > 0 && (
              <Section title={`Provides APIs (${provides.length})`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {provides.map((api, i) => (
                    <ApiChip key={i} api={api} tone="success" onNavigate={onNavigate} />
                  ))}
                </div>
              </Section>
            )}
            {consumes.length > 0 && (
              <Section title={`Consumes APIs (${consumes.length})`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {consumes.map((api, i) => (
                    <ApiChip key={i} api={api} tone="muted" onNavigate={onNavigate} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )
      })()}
      {dbs.length > 0 && (
        <Section title={`Databases (${dbs.length})`}>
          {dbs.map((db, i) => (
            <div key={i} style={{
              fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span style={{ fontWeight: 600, color: '#336791' }}>{db.type}</span>
              <span style={{ color: 'var(--text-muted)' }}>—</span>
              <span style={{ color: 'var(--text)' }}>{db.name}</span>
              {db.hosting && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{db.hosting}</span>}
            </div>
          ))}
        </Section>
      )}
      {svcFindings.length > 0 && (
        <Section title={`Security (${svcFindings.length})`}>
          {svcFindings.map((f, i) => (
            <div key={i} style={{
              fontSize: 12, padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: 'hsl(0 84% 60% / 0.08)', border: '1px solid hsl(0 84% 60% / 0.2)',
              color: 'var(--status-danger)', lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 600 }}>{f.title ?? f.type}</span>
              {f.description && <div style={{ marginTop: 2, color: 'var(--text-muted)', fontSize: 11 }}>{f.description}</div>}
            </div>
          ))}
        </Section>
      )}
      <Section title="Links">
        {repoLink && (
          <a href={repoLink} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', marginBottom: 8 }}>
            Repository: {svc.repo}
          </a>
        )}
        {svc.repoUrl && !svc.repo && (
          <a href={svc.repoUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', marginBottom: 8 }}>
            {svc.repoUrl}
          </a>
        )}
        {catalogLink && (
          <a href={catalogLink} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
            Full catalog entry
          </a>
        )}
      </Section>
    </>
  )
}

function ReadmeTab({ catalogData, catalogLoading, catalogPath }) {
  if (catalogLoading) {
    return (
      <div>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton" style={{ height: 14, width: `${50 + i*10}%`, marginBottom: 10, borderRadius: 4 }} />
        ))}
      </div>
    )
  }
  if (!catalogData?.content) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        {catalogPath ? 'No catalog README found.' : 'No catalog entry linked for this service.'}
      </div>
    )
  }
  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={[remarkGfm]}>
        {stripFrontmatter(catalogData.content)}
      </Markdown>
    </div>
  )
}

function DepsTab({ nodeId, conns, dbs }) {
  const upstream = conns.filter(c => c.from === nodeId)
  const downstream = conns.filter(c => c.to === nodeId)
  return (
    <>
      {upstream.length > 0 && (
        <Section title={`Upstream — calls (${upstream.length})`}>
          {upstream.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--status-success)', fontWeight: 700, width: 16 }}>→</span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{c.to}</span>
              {c.label && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{c.label}</span>}
              {c.protocol && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {c.protocol}{c.port ? `:${c.port}` : ''}
                </span>
              )}
            </div>
          ))}
        </Section>
      )}
      {downstream.length > 0 && (
        <Section title={`Downstream — called by (${downstream.length})`}>
          {downstream.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--status-info)', fontWeight: 700, width: 16 }}>←</span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{c.from}</span>
              {c.label && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{c.label}</span>}
              {c.protocol && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {c.protocol}{c.port ? `:${c.port}` : ''}
                </span>
              )}
            </div>
          ))}
        </Section>
      )}
      {dbs.length > 0 && (
        <Section title={`Databases (${dbs.length})`}>
          {dbs.map((db, i) => (
            <div key={i} style={{
              fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span style={{ fontWeight: 600, color: '#336791' }}>{db.type}</span>
              <span style={{ color: 'var(--text-muted)' }}>—</span>
              <span style={{ color: 'var(--text)' }}>{db.name}</span>
              {db.hosting && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{db.hosting}</span>}
            </div>
          ))}
        </Section>
      )}
    </>
  )
}

const METHOD_COLORS = {
  get: '#22C55E', post: '#3B82F6', put: '#F59E0B', delete: '#EF4444', patch: '#8B5CF6',
}

function EndpointRow({ ep }) {
  const methodColor = METHOD_COLORS[ep.method.toLowerCase()] ?? 'var(--text-muted)'
  const authTag = ep.security?.length === 0 ? 'open' :
    ep.security?.[0] ? Object.keys(ep.security[0])[0] : null

  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#fff',
          background: methodColor, padding: '2px 6px', borderRadius: 4,
          minWidth: 40, textAlign: 'center', letterSpacing: '0.03em',
        }}>{ep.method}</span>
        <code style={{
          fontSize: 12, fontFamily: 'var(--font-mono)',
          color: 'var(--text-heading)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>{ep.path}</code>
        {authTag && (
          <span style={{
            fontSize: 9, flexShrink: 0,
            padding: '1px 6px', borderRadius: 4,
            background: authTag === 'open' ? 'hsl(0 84% 60% / 0.1)' : 'hsl(142 71% 45% / 0.1)',
            color: authTag === 'open' ? 'var(--status-danger)' : 'var(--status-success)',
            border: `1px solid ${authTag === 'open' ? 'hsl(0 84% 60% / 0.2)' : 'hsl(142 71% 45% / 0.2)'}`,
            fontWeight: 500,
          }}>{authTag === 'open' ? '🔓 open' : `🔒 ${authTag}`}</span>
        )}
      </div>
      {(ep.summary || ep.description) && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 48, lineHeight: 1.4 }}>
          {(ep.summary || ep.description || '').slice(0, 150)}
        </div>
      )}
    </div>
  )
}

function CollapsibleGroup({ label, count, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 14, flexShrink: 0 }}>
          {open ? '▼' : '▶'}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', textTransform: 'capitalize' }}>
          {label}
        </span>
        <span style={{
          fontSize: 10, color: 'var(--text-muted)',
          background: 'var(--surface-raised)', padding: '1px 6px', borderRadius: 9999,
          border: '1px solid var(--border)',
        }}>{count}</span>
      </button>
      {open && <div style={{ paddingLeft: 4 }}>{children}</div>}
    </div>
  )
}

// ApiTabMulti renders all API surfaces the entry exposes:
//   - The repo's own openapi.json (current REST case)
//   - Any linked `kind: api` entities the entry declares in providesApis
//     (covers JMS / message-bus APIs that have an `operations` list but no
//     OpenAPI spec).
function ApiTabMulti({ ownOpenapi, linkedApis, onNavigate }) {
  const sections = []
  if (ownOpenapi) {
    sections.push({ key: 'own', title: 'OpenAPI', kind: 'openapi', openapi: ownOpenapi })
  }
  for (const api of linkedApis) {
    const name = api?.spec?.name || api?.metadata?.name || 'API'
    if (api?.openapi) {
      sections.push({ key: name + ':openapi', title: name, kind: 'openapi', openapi: api.openapi, meta: api })
    } else if (api?.spec?.operations?.length > 0) {
      sections.push({ key: name + ':ops', title: name, kind: 'operations', api })
    }
  }
  if (sections.length === 0) return null
  return (
    <>
      {sections.map((s, i) => (
        <div key={s.key} style={{ marginBottom: i < sections.length - 1 ? 32 : 0 }}>
          {sections.length > 1 && (
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)',
            }}>{s.title}</div>
          )}
          {s.kind === 'openapi' && <ApiTab openapi={s.openapi} />}
          {s.kind === 'operations' && <OperationsTab api={s.api} onNavigate={onNavigate} />}
        </div>
      ))}
    </>
  )
}

// OperationsTab renders the `operations[]` list from a `kind: api`
// catalog-info.json. Used for message-bus APIs (JMS/AMQP/MQTT) that don't
// fit OpenAPI. Groups by dotted prefix (e.g. `jms.v0.*`).
function OperationsTab({ api, onNavigate }) {
  const spec = api?.spec ?? {}
  const ops = spec.operations ?? []
  const groups = useMemo(() => {
    const g = {}
    for (const op of ops) {
      const s = String(op)
      const parts = s.split('.')
      const prefix = parts.length >= 2 ? parts.slice(0, parts.length - 1).join('.') : 'root'
      if (!g[prefix]) g[prefix] = []
      g[prefix].push(s)
    }
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
  }, [ops])

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 4 }}>
          {spec.name || 'API'}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>
            · {ops.length} operations · {groups.length} groups
          </span>
        </div>
        {spec.description && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{spec.description}</div>
        )}
        {spec.protocol && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Protocol: <code style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              background: 'var(--surface-raised)', padding: '1px 5px', borderRadius: 3,
            }}>{spec.protocol}</code>
          </div>
        )}
      </div>
      {groups.map(([prefix, ops]) => (
        <CollapsibleGroup key={prefix} label={prefix} count={ops.length} defaultOpen={groups.length <= 3}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ops.map((op) => (
              <code key={op} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                background: 'var(--surface-raised)', padding: '4px 8px', borderRadius: 4,
                border: '1px solid var(--border)', color: 'var(--text)',
                wordBreak: 'break-all',
              }}>{op}</code>
            ))}
          </div>
        </CollapsibleGroup>
      ))}
    </>
  )
}

function ApiTab({ openapi }) {
  if (!openapi) return null

  const info = openapi.info ?? {}
  const paths = openapi.paths ?? {}
  const servers = openapi.servers ?? []

  // Flatten and group by tag (or path prefix as fallback)
  const groups = {}
  let total = 0
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, details] of Object.entries(methods)) {
      if (['parameters', 'servers', 'summary', 'description'].includes(method)) continue
      const ep = { method: method.toUpperCase(), path, ...details }
      total++

      // Group by first tag, or path prefix
      let group = details.tags?.[0]
      if (!group) {
        const segments = path.replace(/^\//, '').split('/')
        group = segments[0] || 'root'
        if (group === 'api' && segments[1]) group = segments[1]
        if (group === 'v1' && segments[1]) group = segments[1]
        if (group === 'v2' && segments[1]) group = segments[1]
      }
      if (!groups[group]) groups[group] = []
      groups[group].push(ep)
    }
  }

  // Sort groups: most endpoints first
  const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 4 }}>
          {info.title ?? 'API'}
          {info.version && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>v{info.version}</span>}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>
            · {total} endpoints · {sortedGroups.length} groups
          </span>
        </div>
        {info.description && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{info.description}</div>
        )}
      </div>

      {/* Servers */}
      {servers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {servers.map((s, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
              <code style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 4,
                border: '1px solid var(--border)',
              }}>{s.url}</code>
              {s.description && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{s.description}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Auth schemes (compact, at top) */}
      {openapi.components?.securitySchemes && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16,
          padding: '8px 12px', background: 'var(--surface-raised)',
          borderRadius: 6, border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Auth:</span>
          {Object.entries(openapi.components.securitySchemes).map(([name, scheme]) => (
            <span key={name} style={{
              fontSize: 11, color: 'var(--status-success)',
              fontFamily: 'var(--font-mono)',
            }}>
              🔒 {name} ({scheme.type}{scheme.in ? ` in ${scheme.in}` : ''})
            </span>
          ))}
        </div>
      )}

      {/* Grouped endpoints */}
      {sortedGroups.map(([group, endpoints], i) => (
        <CollapsibleGroup
          key={group}
          label={group}
          count={endpoints.length}
          defaultOpen={i === 0 || sortedGroups.length <= 3}
        >
          {endpoints.map((ep, j) => <EndpointRow key={j} ep={ep} />)}
        </CollapsibleGroup>
      ))}
    </>
  )
}

const ROLE_COLORS = {
  owner: 'var(--status-success)', maintainer: 'var(--accent)', contributor: 'var(--text-muted)',
}

function TeamTab({ collaborators, contributors }) {
  const hasLocal = collaborators?.length > 0
  // Indirect groups = closest-repo bucketed people from server. Filter out
  // the depth-0 group (the entity itself) since direct contributors are
  // already rendered above as avatar cards.
  const groups = (contributors?.groups || []).filter(g => g.depth > 0)
  const indirectCount = groups.reduce((s, g) => s + g.contributors.length, 0)
  const indirectCommits = groups.reduce((s, g) => s + g.totalCommits, 0)

  if (!hasLocal && !groups.length) return null
  return (
    <>
      {hasLocal && (
        <Section title={`Direct contributors (${collaborators.length})`}>
          <div />
        </Section>
      )}
      {hasLocal && collaborators.map((c, i) => (
        <a
          key={i}
          href={`https://github.com/${c.login}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0', borderBottom: '1px solid var(--border)',
            textDecoration: 'none', transition: 'background 120ms ease',
            borderRadius: 6, margin: '0 -8px', paddingLeft: 8, paddingRight: 8,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <img
            src={`https://github.com/${c.login}.png?size=40`}
            alt={c.login}
            style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, border: '2px solid var(--border)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{c.login}</span>
              <span style={{
                fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 9999,
                color: ROLE_COLORS[c.role] ?? 'var(--text-muted)',
                background: `${ROLE_COLORS[c.role] ?? 'var(--text-muted)'}15`,
                border: `1px solid ${ROLE_COLORS[c.role] ?? 'var(--text-muted)'}30`,
              }}>{c.role}</span>
              {c.recentlyActive && (
                <span style={{ fontSize: 9, color: 'var(--status-success)' }}>● active</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {c.commits} commits
            </div>
          </div>
        </a>
      ))}
      {groups.length > 0 && (
        <Section title={`Indirect contributors (via dependencies · ${indirectCount} · ${indirectCommits.toLocaleString()} commits)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.map(g => <RepoGroup key={g.repoName} repoName={g.repoName} depth={g.depth} people={g.contributors} />)}
          </div>
        </Section>
      )}
    </>
  )
}

export default function DetailDrawer({ service, onClose, onNavigate }) {
  const { connections, databases, securityFindings, catalogPaths } = useArch()
  const [, setServiceParam] = useQueryState('service', parseAsString)
  const drawerRef = useRef(null)

  // Shared graph cache — used to compute transitive ownership / contributing
  // teams by walking down dependsOn + componentRepos + communicatesWith.
  const { entity: lookupEntity, expand } = useGraph()

  // service can be a plain service row (from CatalogView) or just an id string
  const svc = service
  const nodeId = svc?.id ?? (typeof service === 'string' ? service : null)

  // Two team views:
  //   - directOwnerTeams: who OWNS this entity (componentRepos + composedOf
  //     only — short walk). For products → owners of the firmware repos.
  //   - transitiveTeams: every team REACHED by the full alarm-flow walk
  //     (dependsOn + communicatesWith etc.). Wider blast-radius view.
  const aggregateTeams = (entities) => {
    const teams = new Map()
    for (const e of entities) {
      const ownerEdge = (e.outbound || []).find(ed => ed.relation === 'ownerTeam')
      const teamRef = ownerEdge?.target || e.spec?.team
      if (!teamRef) continue
      const slug = ownerEdge?.target || teamRef
      const display = lookupEntity(slug)?.spec?.displayName || teamRef
      if (!teams.has(slug)) teams.set(slug, { name: display, slug, contributors: [] })
      teams.get(slug).contributors.push(e.name)
    }
    return [...teams.values()].sort((a, b) => b.contributors.length - a.contributors.length)
  }

  const directOwnerTeams = useMemo(() => {
    if (!nodeId || !expand) return null
    const owned = expand(nodeId, {
      direction: 'down', depth: 3,
      follow: ['componentRepos', 'composedOf'],
    })
    return owned.length ? aggregateTeams(owned) : null
  }, [nodeId, expand, lookupEntity])

  const transitiveTeams = useMemo(() => {
    if (!nodeId || !expand) return null
    const reachable = expand(nodeId, {
      direction: 'down', depth: 6,
      follow: ['dependsOn', 'componentRepos', 'communicatesWith', 'composedOf', 'storedIn', 'realizedBy'],
    })
    return reachable.length ? aggregateTeams(reachable) : null
  }, [nodeId, expand, lookupEntity])

  // Indirect contributors — fetched from Brain. Traversal, depth tagging,
  // role ranking, closest-repo grouping all happen server-side in
  // `Stitcher.Contributors()`. Frontend just renders the response.
  const { data: contributors } = useQuery({
    queryKey: ['entity-contributors', nodeId],
    queryFn: () => nodeId ? fetchEntityContributors(nodeId, { depth: 6 }) : null,
    enabled: !!nodeId,
    staleTime: 5 * 60 * 1000,
  })

  // (Dead — kept inert until ship; the value below is never read.)
  // eslint-disable-next-line no-unused-vars
  const _legacyTransitive = useMemo(() => {
    if (!nodeId || !lookupEntity) return null
    const root = lookupEntity(nodeId)
    if (!root) return null
    const FOLLOW = new Set(['dependsOn','componentRepos','communicatesWith','composedOf','storedIn','realizedBy'])
    const MAX_DEPTH = 6
    const depthByName = new Map([[nodeId, 0]])
    let frontier = [nodeId]
    for (let d = 0; d < MAX_DEPTH; d++) {
      const next = []
      for (const cur of frontier) {
        const e = lookupEntity(cur)
        if (!e) continue
        for (const ed of (e.outbound || [])) {
          if (!FOLLOW.has(ed.relation)) continue
          if (depthByName.has(ed.target)) continue
          depthByName.set(ed.target, d + 1)
          next.push(ed.target)
        }
      }
      frontier = next
      if (!frontier.length) break
    }
    const byLogin = new Map()
    const ROLE_RANK = { owner: 3, maintainer: 2, contributor: 1 }
    for (const [name, depth] of depthByName) {
      const e = lookupEntity(name)
      for (const c of (e?.spec?.collaborators || [])) {
        if (!c.login) continue
        const acc = byLogin.get(c.login) || {
          login: c.login, totalCommits: 0, repos: [],
          recentlyActive: false, topRole: null, minDepth: Infinity,
        }
        acc.totalCommits += (c.commits || 0)
        acc.repos.push({ name, depth, commits: c.commits || 0, role: c.role })
        if (c.recentlyActive) acc.recentlyActive = true
        if ((ROLE_RANK[c.role] || 0) > (ROLE_RANK[acc.topRole] || 0)) acc.topRole = c.role
        if (depth < acc.minDepth) acc.minDepth = depth
        byLogin.set(c.login, acc)
      }
    }
    // Closer first; within same depth, more commits first.
    // Sort each person's repo list closest-first too.
    const people = [...byLogin.values()]
    for (const p of people) p.repos.sort((a, b) => a.depth - b.depth || b.commits - a.commits)
    people.sort((a, b) => a.minDepth - b.minDepth || b.totalCommits - a.totalCommits)
    return people
  }, [nodeId, lookupEntity])

  const dbs   = findDatabasesFor(databases, nodeId)
  const svcFindings = (securityFindings ?? []).filter(f =>
    f.service === nodeId || f.id === nodeId
  )
  // Resolve catalog entry: try direct domain/name from service, fall back to catalogPaths lookup
  const catalogPath = catalogPaths?.[nodeId]
  let catalogDomain, catalogName
  if (svc?.domain && svc.domain !== 'unknown') {
    // Direct: repo name IS the catalog folder name
    catalogDomain = svc.domain
    catalogName = svc.repo || svc.name || nodeId
  } else if (catalogPath) {
    // Fallback: diagram node ID mapped via catalogPaths
    catalogDomain = catalogPath.split('/')[0]
    catalogName = catalogPath.split('/')[1]?.replace('/README.md', '').replace('.md', '')
  }

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ['catalog', catalogDomain, catalogName],
    queryFn: () => fetchCatalogEntry(catalogDomain, catalogName),
    enabled: !!catalogDomain && !!catalogName,
  })

  // Catalog v2: prefer spec.dependsOn / spec.consumedBy (rich: protocol, port,
  // purpose, kind) over the synthesized graph connections (from + to only).
  // Fall back to graph-derived connections when spec hasn't loaded yet.
  const conns = useMemo(() => {
    const spec = catalogData?.spec
    if (spec && (Array.isArray(spec.dependsOn) || Array.isArray(spec.consumedBy))) {
      const upstream = (spec.dependsOn || []).map(d => ({
        from: nodeId, to: d.target, kind: d.kind,
        protocol: d.protocol, port: d.port, label: d.purpose,
      }))
      const downstream = (spec.consumedBy || []).map(t => ({
        from: typeof t === 'string' ? t : t.target,
        to: nodeId,
      }))
      return [...upstream, ...downstream]
    }
    return findConnectionsFor(connections, nodeId)
  }, [catalogData, connections, nodeId])

  // Esc to close
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { setServiceParam(null); onClose?.() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, setServiceParam])

  // Click outside to close
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) { setServiceParam(null); onClose?.() }
  }, [onClose, setServiceParam])

  const handleClose = useCallback(() => {
    setServiceParam(null)
    onClose?.()
  }, [onClose, setServiceParam])

  if (!svc) return null

  const status = catalogData?.metadata?.status ?? svc.status ?? 'unknown'

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.35)',
      }}
    >
      <div
        ref={drawerRef}
        className="drawer-enter"
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 480, maxWidth: '50vw',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.2, marginRight: 12 }}>
              {svc.name ?? svc.label ?? svc.id}
            </h2>
            <button
              onClick={handleClose}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, borderRadius: 6,
                fontSize: 20, lineHeight: 1, flexShrink: 0,
                transition: 'color 120ms ease',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={status} />
            <DomainBadge domain={svc.domain ?? svc.domainLabel} />
          </div>
        </div>

        {/* ── Tabs ── */}
        <DrawerTabs
          svc={svc} nodeId={nodeId} conns={conns} dbs={dbs}
          svcFindings={svcFindings} catalogPath={catalogPath}
          catalogData={catalogData} catalogLoading={catalogLoading}
          directOwnerTeams={directOwnerTeams}
          transitiveTeams={transitiveTeams}
          contributors={contributors}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  )
}
