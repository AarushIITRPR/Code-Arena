import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  Code2,
  DatabaseZap,
  ExternalLink,
  FileText,
  Folder,
  Hash,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from 'lucide-react'
import './App.css'

const DEFAULT_HANDLE = localStorage.getItem('codearena:handle') || 'tourist'

const VIEW_OPTIONS = ['inbox', 'discovery', 'insights', 'revision']
const VIEW_ALIASES = {
  analytics: 'insights',
  profile: 'insights',
  today: 'inbox',
}
const STATUS_OPTIONS = ['Planned', 'Attempted', 'Solved', 'Revise']
const QUEUE_OPTIONS = ['Today', 'Revision', 'Weak Topic', 'Later']
const MISTAKE_OPTIONS = [
  '',
  'Concept gap',
  'Implementation bug',
  'Edge case missed',
  'TLE / optimization',
  'Could not derive approach',
]
const FALLBACK_TOPICS = [
  ['dp', 0],
  ['graphs', 0],
  ['greedy', 0],
  ['math', 0],
  ['data structures', 0],
  ['strings', 0],
]
const TOPIC_LABELS = {
  dp: 'Dynamic Programming',
  graphs: 'Graphs',
  greedy: 'Greedy',
  math: 'Math',
  'data structures': 'Data Structures',
  strings: 'Strings',
  implementation: 'Implementation',
  brute: 'Brute Force',
  constructive: 'Constructive Algorithms',
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (response.status === 204) {
    return null
  }

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Request failed')
  }

  return payload
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value ?? 0)
}

function formatShortDate(value) {
  if (!value) return 'Not synced'

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function toEntries(record = {}) {
  return Object.entries(record).sort(([, firstCount], [, secondCount]) => {
    return secondCount - firstCount
  })
}

function humanizeTopic(topic = 'general') {
  return (
    TOPIC_LABELS[topic] ||
    topic
      .split(' ')
      .filter(Boolean)
      .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
      .join(' ') ||
    'General'
  )
}

function getProblemTopic(problem) {
  return problem.tags?.[0] ?? 'general'
}

function getStatusClass(status = 'Planned') {
  return status.toLowerCase().replaceAll(' ', '-')
}

function getInitialView() {
  const hashView = window.location.hash.replace('#', '')
  const normalizedView = VIEW_ALIASES[hashView] ?? hashView
  return VIEW_OPTIONS.includes(normalizedView) ? normalizedView : 'insights'
}

function getVisiblePages(currentPage, totalPages) {
  const pages = new Set([1, totalPages])

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page)
    }
  }

  return [...pages].sort((firstPage, secondPage) => firstPage - secondPage)
}

function topicMatches(problem, topic) {
  return problem.tags?.some((tag) => tag.toLowerCase() === topic.toLowerCase())
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-note">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

function PropertyRow({ icon: Icon, label, value }) {
  return (
    <div className="property-row">
      <Icon size={14} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function VaultButton({ active, count, icon: Icon, label, onClick }) {
  return (
    <button
      className={active ? 'vault-nav-item active' : 'vault-nav-item'}
      onClick={onClick}
      type="button"
    >
      <span>
        <Icon size={14} />
        {label}
      </span>
      {count !== undefined && <strong>{count}</strong>}
    </button>
  )
}

function TopicGraph({ centerLabel, nodes, onNodeClick }) {
  const slots = [
    { x: 50, y: 15 },
    { x: 79, y: 30 },
    { x: 78, y: 64 },
    { x: 50, y: 82 },
    { x: 20, y: 64 },
    { x: 19, y: 31 },
  ]

  return (
    <div className="topic-graph" aria-label="Topic graph">
      <svg aria-hidden="true" viewBox="0 0 100 100">
        {nodes.slice(0, 6).map((node, index) => (
          <line
            key={node.label}
            x1="50"
            x2={slots[index].x}
            y1="50"
            y2={slots[index].y}
          />
        ))}
      </svg>
      <button className="graph-center" type="button">
        {centerLabel}
      </button>
      {nodes.slice(0, 6).map((node, index) => (
        <button
          className="graph-node"
          key={node.label}
          onClick={() => onNodeClick(node.key)}
          style={{
            left: `${slots[index].x}%`,
            top: `${slots[index].y}%`,
          }}
          type="button"
        >
          {node.label}
        </button>
      ))}
    </div>
  )
}

function ProblemNoteCard({
  disabled,
  mode,
  onDelete,
  onDraftNote,
  onTrack,
  onUpdate,
  problem,
  tracked,
}) {
  const topic = getProblemTopic(problem)
  const isTracked = Boolean(tracked)
  const noteText =
    problem.notes ||
    (mode === 'discovery'
      ? `Practice candidate from ${topic} around ${problem.rating ?? 'unrated'} rating.`
      : 'No note written yet.')

  return (
    <article className={`problem-note ${mode}`}>
      <div className="problem-note-head">
        <a href={problem.url} rel="noreferrer" target="_blank">
          {problem.externalId} - {problem.title}
          <ExternalLink size={12} />
        </a>
        {problem.status && (
          <span className={`status-pill ${getStatusClass(problem.status)}`}>
            {problem.status}
          </span>
        )}
      </div>

      <p className="problem-note-meta">
        {problem.rating ?? 'Unrated'} / {problem.tags?.slice(0, 2).join(', ') || topic}
      </p>
      <p>
        <strong>Key idea:</strong> {noteText}
      </p>
      <p>
        <strong>Mistake:</strong>{' '}
        {problem.mistakeType || (mode === 'discovery' ? 'not attempted yet' : 'not logged')}
      </p>

      <div className="tag-line">
        {(problem.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>

      {(mode === 'tracked' || mode === 'revision') && (
        <div className="note-edit-stack">
          <div className="note-control-grid">
            <select
              onChange={(event) =>
                onUpdate(problem.id, { status: event.target.value })
              }
              value={problem.status}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <select
              onChange={(event) =>
                onUpdate(problem.id, { queue: event.target.value })
              }
              value={problem.queue}
            >
              {QUEUE_OPTIONS.map((queue) => (
                <option key={queue}>{queue}</option>
              ))}
            </select>
          </div>
          <div className="note-control-grid">
            <select
              onChange={(event) =>
                onUpdate(problem.id, {
                  mistakeType: event.target.value || null,
                })
              }
              value={problem.mistakeType ?? ''}
            >
              {MISTAKE_OPTIONS.map((mistake) => (
                <option key={mistake} value={mistake}>
                  {mistake || 'No mistake'}
                </option>
              ))}
            </select>
            <select
              onChange={(event) =>
                onUpdate(problem.id, {
                  confidence: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              value={problem.confidence ?? ''}
            >
              <option value="">Confidence</option>
              {[1, 2, 3, 4, 5].map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </select>
          </div>
          <textarea
            aria-label={`Notes for ${problem.title}`}
            onBlur={(event) => onUpdate(problem.id, { notes: event.target.value })}
            onChange={(event) => onDraftNote(problem.id, event.target.value)}
            placeholder="Approach, bug, edge case"
            value={problem.notes ?? ''}
          />
        </div>
      )}

      <footer>
        <span>{formatShortDate(problem.updatedAt || problem.createdAt)}</span>
        {mode === 'discovery' ? (
          <button
            disabled={disabled || isTracked}
            onClick={() => onTrack(problem)}
            type="button"
          >
            <Plus size={13} />
            {isTracked ? 'Saved' : 'Add'}
          </button>
        ) : mode === 'tracked' || mode === 'revision' ? (
          <button disabled={disabled} onClick={() => onDelete(problem.id)} type="button">
            <Trash2 size={13} />
          </button>
        ) : (
          <span>linked note</span>
        )}
      </footer>
    </article>
  )
}

function App() {
  const [activeView, setActiveView] = useState(getInitialView)
  const [focusTopic, setFocusTopic] = useState('dp')
  const [handleInput, setHandleInput] = useState(DEFAULT_HANDLE)
  const [activeHandle, setActiveHandle] = useState(DEFAULT_HANDLE)
  const [dashboard, setDashboard] = useState(null)
  const [dashboardState, setDashboardState] = useState({
    loading: true,
    error: '',
  })

  const [filters, setFilters] = useState({
    search: '',
    tag: 'dp',
    minRating: '800',
    maxRating: '1600',
    limit: '40',
    page: '1',
  })
  const [problemData, setProblemData] = useState(null)
  const [problemState, setProblemState] = useState({ loading: true, error: '' })

  const [trackedProblems, setTrackedProblems] = useState([])
  const [trackedState, setTrackedState] = useState({ loading: true, error: '' })
  const [savingId, setSavingId] = useState('')

  async function loadDashboard(handle, shouldRefresh = false) {
    const trimmedHandle = handle.trim()

    if (!trimmedHandle) {
      setDashboardState({ loading: false, error: 'Enter a Codeforces handle.' })
      return
    }

    setDashboardState({ loading: true, error: '' })
    setActiveHandle(trimmedHandle)
    localStorage.setItem('codearena:handle', trimmedHandle)

    try {
      const method = shouldRefresh ? 'POST' : 'GET'
      const suffix = shouldRefresh ? '/refresh' : ''
      const data = await apiRequest(
        `/api/codeforces/dashboard/${encodeURIComponent(trimmedHandle)}${suffix}?count=500`,
        { method },
      )

      setDashboard(data)
      setDashboardState({ loading: false, error: '' })
    } catch (error) {
      setDashboardState({ loading: false, error: error.message })
    }
  }

  async function loadProblems(nextFilters = filters) {
    setProblemState({ loading: true, error: '' })

    const params = new URLSearchParams()

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (String(value).trim()) {
        params.set(key, String(value).trim())
      }
    })

    try {
      const data = await apiRequest(`/api/codeforces/problems?${params}`)
      setProblemData(data)
      setProblemState({ loading: false, error: '' })
    } catch (error) {
      setProblemState({ loading: false, error: error.message })
    }
  }

  async function refreshProblemCache() {
    setProblemState({ loading: true, error: '' })

    try {
      await apiRequest('/api/codeforces/problems/refresh', { method: 'POST' })
      await loadProblems({ ...filters, page: '1' })
    } catch (error) {
      setProblemState({ loading: false, error: error.message })
    }
  }

  async function loadTrackedProblems() {
    setTrackedState({ loading: true, error: '' })

    try {
      const data = await apiRequest('/api/problems')
      setTrackedProblems(data.problems ?? [])
      setTrackedState({ loading: false, error: '' })
    } catch (error) {
      setTrackedState({ loading: false, error: error.message })
    }
  }

  async function trackProblem(problem, queue = 'Today') {
    setSavingId(problem.externalId)

    try {
      await apiRequest('/api/problems', {
        method: 'POST',
        body: JSON.stringify({
          ...problem,
          status: 'Planned',
          queue,
        }),
      })
      await loadTrackedProblems()
    } catch (error) {
      setTrackedState({ loading: false, error: error.message })
    } finally {
      setSavingId('')
    }
  }

  async function updateTrackedProblem(problemId, updates) {
    setSavingId(problemId)

    setTrackedProblems((currentProblems) =>
      currentProblems.map((problem) =>
        problem.id === problemId ? { ...problem, ...updates } : problem,
      ),
    )

    try {
      const updatedProblem = await apiRequest(`/api/problems/${problemId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })

      setTrackedProblems((currentProblems) =>
        currentProblems.map((problem) =>
          problem.id === problemId ? updatedProblem : problem,
        ),
      )
    } catch (error) {
      setTrackedState({ loading: false, error: error.message })
      await loadTrackedProblems()
    } finally {
      setSavingId('')
    }
  }

  async function deleteTrackedProblem(problemId) {
    setSavingId(problemId)

    try {
      await apiRequest(`/api/problems/${problemId}`, { method: 'DELETE' })
      setTrackedProblems((currentProblems) =>
        currentProblems.filter((problem) => problem.id !== problemId),
      )
    } catch (error) {
      setTrackedState({ loading: false, error: error.message })
    } finally {
      setSavingId('')
    }
  }

  function draftProblemNote(problemId, notes) {
    setTrackedProblems((currentProblems) =>
      currentProblems.map((problem) =>
        problem.id === problemId ? { ...problem, notes } : problem,
      ),
    )
  }

  useEffect(() => {
    loadDashboard(DEFAULT_HANDLE)
    loadProblems()
    loadTrackedProblems()
  }, [])

  useEffect(() => {
    function syncViewFromHash() {
      setActiveView(getInitialView())
    }

    window.addEventListener('hashchange', syncViewFromHash)
    return () => window.removeEventListener('hashchange', syncViewFromHash)
  }, [])

  function navigateToView(view) {
    window.location.hash = view
    setActiveView(view)
  }

  function openTopic(topic) {
    const nextFilters = { ...filters, tag: topic, page: '1' }
    setFocusTopic(topic)
    setFilters(nextFilters)
    navigateToView('insights')
    loadProblems(nextFilters)
  }

  function goToProblemPage(page) {
    const nextFilters = {
      ...filters,
      page: String(page),
    }
    setFilters(nextFilters)
    loadProblems(nextFilters)
  }

  const dashboardSummary = dashboard?.submissionSummary
  const tagEntries = useMemo(
    () => toEntries(dashboardSummary?.solvedByTag).slice(0, 10),
    [dashboardSummary],
  )
  const sidebarTopics = tagEntries.length ? tagEntries : FALLBACK_TOPICS

  const trackedSummary = useMemo(() => {
    const revisionProblems = trackedProblems.filter((problem) => {
      return problem.status === 'Revise' || problem.queue === 'Revision'
    })
    const solvedProblems = trackedProblems.filter(
      (problem) => problem.status === 'Solved',
    )
    const lowConfidence = trackedProblems.filter(
      (problem) => problem.confidence !== null && problem.confidence <= 2,
    )
    const inboxProblems = trackedProblems.filter((problem) => {
      return problem.status !== 'Revise' && problem.queue !== 'Revision'
    })

    return {
      total: trackedProblems.length,
      inbox: inboxProblems.length,
      revision: revisionProblems.length,
      solved: solvedProblems.length,
      lowConfidence: lowConfidence.length,
    }
  }, [trackedProblems])

  const trackedExternalIds = useMemo(() => {
    return new Set(trackedProblems.map((problem) => problem.externalId))
  }, [trackedProblems])

  const inboxProblems = useMemo(() => {
    return trackedProblems.filter((problem) => {
      return problem.status !== 'Revise' && problem.queue !== 'Revision'
    })
  }, [trackedProblems])

  const revisionProblems = useMemo(() => {
    return trackedProblems.filter((problem) => {
      return problem.status === 'Revise' || problem.queue === 'Revision'
    })
  }, [trackedProblems])

  const topicTrackedProblems = useMemo(() => {
    return trackedProblems.filter((problem) => topicMatches(problem, focusTopic))
  }, [focusTopic, trackedProblems])

  const topicDiscoveryProblems = useMemo(() => {
    return (problemData?.problems ?? []).filter((problem) =>
      topicMatches(problem, focusTopic),
    )
  }, [focusTopic, problemData])

  const recommendedProblems = useMemo(() => {
    const solvedTags = new Set(tagEntries.slice(0, 4).map(([tag]) => tag))

    return (problemData?.problems ?? [])
      .filter((problem) => !trackedExternalIds.has(problem.externalId))
      .map((problem) => ({
        ...problem,
        reason: solvedTags.has(getProblemTopic(problem))
          ? 'same topic depth'
          : 'coverage gap',
      }))
      .slice(0, 8)
  }, [problemData, tagEntries, trackedExternalIds])

  const currentTopicSolved =
    sidebarTopics.find(([topic]) => topic === focusTopic)?.[1] ?? 0
  const topicAccuracy = dashboardSummary?.attemptedCount
    ? `${Math.round((currentTopicSolved / dashboardSummary.attemptedCount) * 100)}%`
    : '0%'

  const graphNodes = sidebarTopics
    .filter(([topic]) => topic !== focusTopic)
    .slice(0, 6)
    .map(([topic]) => ({
      key: topic,
      label: topic.length > 12 ? topic.split(' ')[0] : topic,
    }))

  let documentTitle = humanizeTopic(focusTopic)
  let documentCrumb = `Topics / ${focusTopic}`
  let documentCards = [
    ...topicTrackedProblems,
    ...topicDiscoveryProblems.filter(
      (problem) => !trackedExternalIds.has(problem.externalId),
    ),
  ].slice(0, 6)
  let documentMode = 'topic'
  let sectionTitle = 'Problem Notes'
  let emptyTitle = 'No notes linked yet'
  let emptyBody = 'Save problems from discovery to build this topic note.'
  let properties = [
    { icon: Check, label: 'Solved', value: formatNumber(currentTopicSolved) },
    {
      icon: Circle,
      label: 'Tracked',
      value: formatNumber(topicTrackedProblems.length),
    },
    { icon: Hash, label: 'Accuracy', value: topicAccuracy },
    {
      icon: BookOpen,
      label: 'Last practiced',
      value: formatShortDate(dashboard?.syncedAt),
    },
  ]

  if (activeView === 'inbox') {
    documentTitle = 'Practice Inbox'
    documentCrumb = 'Discovery / inbox'
    documentCards = inboxProblems
    documentMode = 'tracked'
    sectionTitle = 'Queued Notes'
    emptyTitle = 'Inbox is clear'
    emptyBody = 'Add problems from discovery to create your working queue.'
    properties = [
      { icon: FileText, label: 'Inbox', value: trackedSummary.inbox },
      { icon: Check, label: 'Solved', value: trackedSummary.solved },
      {
        icon: Circle,
        label: 'Attempted',
        value: formatNumber(dashboardSummary?.attemptedCount),
      },
      {
        icon: Hash,
        label: 'Rating',
        value: dashboard?.profile?.rating ?? 'Unrated',
      },
    ]
  }

  if (activeView === 'discovery') {
    documentTitle = 'Problem Discovery'
    documentCrumb = 'Discovery / problem discovery'
    documentCards = problemData?.problems ?? []
    documentMode = 'discovery'
    sectionTitle = 'Search Results'
    emptyTitle = problemState.loading ? 'Searching' : 'No problems found'
    emptyBody = problemState.loading
      ? 'Loading matching Codeforces problems.'
      : 'Try a different topic, rating band, or title.'
    properties = [
      {
        icon: Search,
        label: 'Matched',
        value: formatNumber(problemData?.totalMatched),
      },
      {
        icon: FileText,
        label: 'Page',
        value: `${problemData?.page ?? filters.page} / ${problemData?.totalPages ?? 1}`,
      },
      { icon: Hash, label: 'Rows', value: filters.limit },
      {
        icon: DatabaseZap,
        label: 'Cached',
        value: problemData?.cachedAt ? formatShortDate(problemData.cachedAt) : 'Ready',
      },
    ]
  }

  if (activeView === 'revision') {
    documentTitle = 'Revision Log'
    documentCrumb = 'Revision / log'
    documentCards = revisionProblems
    documentMode = 'revision'
    sectionTitle = 'Revision Notes'
    emptyTitle = 'Revision log is clear'
    emptyBody = 'Mark a tracked problem as Revise to bring it here.'
    properties = [
      { icon: FileText, label: 'Revision', value: trackedSummary.revision },
      { icon: Circle, label: 'Low confidence', value: trackedSummary.lowConfidence },
      { icon: Check, label: 'Solved', value: trackedSummary.solved },
      {
        icon: BookOpen,
        label: 'Last synced',
        value: formatShortDate(dashboard?.syncedAt),
      },
    ]
  }

  const backlinks = [
    ...revisionProblems.slice(0, 2).map((problem) => problem.title),
    ...recommendedProblems.slice(0, 2).map((problem) => problem.title),
  ]
  const currentPage = Number(problemData?.page ?? filters.page)
  const totalPages = Number(problemData?.totalPages ?? 1)
  const visiblePages = getVisiblePages(currentPage, totalPages)

  return (
    <main className="vault-shell">
      <aside className="vault-sidebar" aria-label="CodeArena vault navigation">
        <div className="vault-brand">
          <strong>CodeArena Vault</strong>
        </div>

        <section className="vault-nav-section">
          <h2>Discovery</h2>
          <VaultButton
            active={activeView === 'inbox'}
            count={trackedSummary.inbox}
            icon={FileText}
            label="Inbox"
            onClick={() => navigateToView('inbox')}
          />
          <VaultButton
            active={activeView === 'inbox'}
            icon={Circle}
            label="Today"
            onClick={() => navigateToView('inbox')}
          />
          <VaultButton
            active={activeView === 'discovery'}
            count={problemData?.count}
            icon={Search}
            label="Problem Discovery"
            onClick={() => navigateToView('discovery')}
          />
        </section>

        <section className="vault-nav-section">
          <h2>Knowledge</h2>
          <VaultButton
            active={activeView === 'insights'}
            count={sidebarTopics.length}
            icon={Folder}
            label="Topics"
            onClick={() => navigateToView('insights')}
          />
          <div className="topic-tree">
            {sidebarTopics.slice(0, 6).map(([topic, count]) => (
              <button
                className={
                  activeView === 'insights' && focusTopic === topic
                    ? 'topic-tree-item active'
                    : 'topic-tree-item'
                }
                key={topic}
                onClick={() => openTopic(topic)}
                type="button"
              >
                <ChevronRight size={13} />
                <span>{topic}</span>
                <strong>{count || ''}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="vault-nav-section">
          <h2>Revision</h2>
          <VaultButton
            active={activeView === 'revision'}
            count={trackedSummary.revision}
            icon={BookOpen}
            label="Revision Log"
            onClick={() => navigateToView('revision')}
          />
        </section>

        <section className="vault-nav-section">
          <h2>Assets</h2>
          <VaultButton icon={FileText} label="Templates" onClick={() => {}} />
          <VaultButton icon={Code2} label="Snippets" onClick={() => {}} />
        </section>

        <footer className="vault-account">
          <div>{activeHandle.slice(0, 1).toUpperCase()}</div>
          <span>
            <strong>{activeHandle}</strong>
            <em>rating {dashboard?.profile?.rating ?? 'unrated'}</em>
          </span>
        </footer>
      </aside>

      <section className="vault-document">
        {(dashboardState.error || problemState.error || trackedState.error) && (
          <div className="error-strip">
            {[dashboardState.error, problemState.error, trackedState.error]
              .filter(Boolean)
              .map((error) => (
                <span key={error}>{error}</span>
              ))}
          </div>
        )}

        <header className="note-topbar">
          <span>{documentCrumb}</span>
          <div>
            <form
              className="handle-sync"
              onSubmit={(event) => {
                event.preventDefault()
                loadDashboard(handleInput, true)
              }}
            >
              <input
                aria-label="Codeforces handle"
                onChange={(event) => setHandleInput(event.target.value)}
                placeholder="tourist"
                value={handleInput}
              />
              <button disabled={dashboardState.loading} type="submit">
                {dashboardState.loading ? (
                  <Loader2 className="spin" size={14} />
                ) : (
                  <RefreshCcw size={14} />
                )}
                Sync
              </button>
            </form>
            <button
              className="icon-button"
              onClick={refreshProblemCache}
              title="Refresh problem cache"
              type="button"
            >
              <DatabaseZap size={15} />
            </button>
            <button className="icon-button" title="Edit note" type="button">
              <Pencil size={15} />
            </button>
          </div>
        </header>

        <section className="note-hero">
          <div className="note-properties">
            <h1>{documentTitle}</h1>
            <h2>Properties</h2>
            <div>
              {properties.map((property) => (
                <PropertyRow
                  icon={property.icon}
                  key={property.label}
                  label={property.label}
                  value={property.value}
                />
              ))}
              <button
                className="add-property"
                onClick={() => navigateToView('discovery')}
                type="button"
              >
                <Plus size={14} />
                Add problem
              </button>
            </div>
          </div>

          <TopicGraph
            centerLabel={activeView === 'insights' ? focusTopic : 'vault'}
            nodes={graphNodes}
            onNodeClick={openTopic}
          />
        </section>

        {activeView === 'discovery' && (
          <form
            className="query-console"
            onSubmit={(event) => {
              event.preventDefault()
              const nextFilters = { ...filters, page: '1' }
              if (nextFilters.tag.trim()) {
                setFocusTopic(nextFilters.tag.trim())
              }
              setFilters(nextFilters)
              loadProblems(nextFilters)
            }}
          >
            <label>
              <span>Search</span>
              <input
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    search: event.target.value,
                  }))
                }
                placeholder="watermelon, 4-A, graphs"
                value={filters.search}
              />
            </label>
            <label>
              <span>Tag</span>
              <input
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    tag: event.target.value,
                  }))
                }
                placeholder="dp"
                value={filters.tag}
              />
            </label>
            <label>
              <span>Min</span>
              <input
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    minRating: event.target.value,
                  }))
                }
                value={filters.minRating}
              />
            </label>
            <label>
              <span>Max</span>
              <input
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    maxRating: event.target.value,
                  }))
                }
                value={filters.maxRating}
              />
            </label>
            <label>
              <span>Rows</span>
              <select
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    limit: event.target.value,
                    page: '1',
                  }))
                }
                value={filters.limit}
              >
                {['20', '40', '100', '200'].map((limit) => (
                  <option key={limit}>{limit}</option>
                ))}
              </select>
            </label>
            <button disabled={problemState.loading} type="submit">
              {problemState.loading ? (
                <Loader2 className="spin" size={14} />
              ) : (
                <Search size={14} />
              )}
              Search
            </button>
          </form>
        )}

        <section className="note-section">
          <div className="note-section-head">
            <h2>{sectionTitle}</h2>
            {activeView === 'discovery' && problemData && (
              <div className="pagination-row">
                <button
                  disabled={!problemData.hasPreviousPage || problemState.loading}
                  onClick={() => goToProblemPage(currentPage - 1)}
                  type="button"
                >
                  Prev
                </button>
                <span>
                  {visiblePages.map((page, index) => (
                    <button
                      className={page === currentPage ? 'active' : ''}
                      key={page}
                      onClick={() => goToProblemPage(page)}
                      type="button"
                    >
                      {index > 0 && page - visiblePages[index - 1] > 1
                        ? `... ${page}`
                        : page}
                    </button>
                  ))}
                </span>
                <button
                  disabled={!problemData.hasNextPage || problemState.loading}
                  onClick={() => goToProblemPage(currentPage + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {documentCards.length === 0 ? (
            <EmptyState body={emptyBody} title={emptyTitle} />
          ) : (
            <div className="problem-note-grid">
              {documentCards.map((problem) => (
                <ProblemNoteCard
                  disabled={
                    savingId === problem.id || savingId === problem.externalId
                  }
                  key={problem.id ?? problem.externalId}
                  mode={documentMode}
                  onDelete={deleteTrackedProblem}
                  onDraftNote={draftProblemNote}
                  onTrack={(selectedProblem) =>
                    trackProblem(
                      selectedProblem,
                      activeView === 'revision' ? 'Revision' : 'Today',
                    )
                  }
                  onUpdate={updateTrackedProblem}
                  problem={problem}
                  tracked={trackedExternalIds.has(problem.externalId)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="linked-mentions">
          <header>
            <span>Linked mentions</span>
            <button type="button">x</button>
          </header>
          {backlinks.length === 0 ? (
            <p>No backlinks yet.</p>
          ) : (
            backlinks.map((link) => <p key={link}>- [[{link}]]</p>)
          )}
        </aside>

        <footer className="vault-statusbar">
          <span>{backlinks.length} backlinks</span>
          <span>{documentCards.length * 64 + 128} words</span>
          <span>{formatNumber(documentCards.length * 420 + 1204)} characters</span>
          <span>synced {formatShortDate(dashboard?.syncedAt)}</span>
        </footer>
      </section>
    </main>
  )
}

export default App
