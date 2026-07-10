import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  DatabaseZap,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const DEFAULT_HANDLE = localStorage.getItem('codearena:handle') || 'tourist'

const VIEW_OPTIONS = ['inbox', 'discovery', 'insights', 'revision']
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
const CHART_COLORS = ['#111111', '#57534e', '#a8a29e', '#d6d3d1']
const PROBLEM_PAGE_SIZE = 40
const CODEFORCES_TAG_OPTIONS = [
  'implementation',
  'math',
  'greedy',
  'dp',
  'data structures',
  'brute force',
  'constructive algorithms',
  'graphs',
  'sortings',
  'binary search',
  'dfs and similar',
  'trees',
  'strings',
  'number theory',
  'combinatorics',
  'bitmasks',
  'two pointers',
  'dsu',
  'geometry',
  'shortest paths',
  'probabilities',
  'divide and conquer',
  'hashing',
  'games',
  'flows',
  'matrices',
]

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

function getRatingBand(entries) {
  const bands = new Map()

  entries
    .filter(([rating]) => rating !== 'unrated')
    .map(([rating, count]) => [Number(rating), count])
    .sort(([firstRating], [secondRating]) => firstRating - secondRating)
    .forEach(([rating, count]) => {
      const bandStart = Math.floor(rating / 200) * 200
      const label = `${bandStart}-${bandStart + 199}`
      bands.set(label, (bands.get(label) ?? 0) + count)
    })

  return [...bands.entries()]
}

function getProblemTopic(problem) {
  return problem.tags?.[0] ?? 'general'
}

function getStatusClass(status) {
  return status.toLowerCase().replaceAll(' ', '-')
}

function getRatingAccent(rating) {
  if (rating === null || rating === undefined) return '#808080'
  if (rating < 1200) return '#808080'
  if (rating < 1400) return '#008000'
  if (rating < 1600) return '#03a89e'
  if (rating < 1900) return '#0000ff'
  if (rating < 2100) return '#aa00aa'
  if (rating < 2400) return '#ff8c00'
  if (rating < 3000) return '#ff0000'
  return '#aa0000'
}

function formatTagSummary(tags) {
  if (tags.length === 0) return 'Choose tags'
  if (tags.length <= 2) return tags.join(', ')

  return `${tags.slice(0, 2).join(', ')} +${tags.length - 2}`
}

function getInitialView() {
  const hashView = window.location.hash.replace('#', '')
  return VIEW_OPTIONS.includes(hashView) ? hashView : 'inbox'
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

function EmptyState({ title, body }) {
  return (
    <div className="empty-line">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

function CodeforcesIcon() {
  return (
    <span className="codeforces-icon" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function InsightRow({ label, value }) {
  return (
    <div className="insight-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="chart-tooltip">
      <strong>{label || payload[0].name}</strong>
      {payload.map((entry) => (
        <span key={entry.name}>
          {entry.name}: {formatNumber(entry.value)}
        </span>
      ))}
    </div>
  )
}

function ScreenHeader({ eyebrow, title, body, action }) {
  return (
    <header className="screen-header">
      <div>
        <span className="breadcrumb">{eyebrow}</span>
        <h1>{title}</h1>
        {body && <p>{body}</p>}
      </div>
      {action}
    </header>
  )
}

function App() {
  const [activeView, setActiveView] = useState(getInitialView)
  const [handleInput, setHandleInput] = useState(DEFAULT_HANDLE)
  const [activeHandle, setActiveHandle] = useState(DEFAULT_HANDLE)
  const [dashboard, setDashboard] = useState(null)
  const [dashboardState, setDashboardState] = useState({
    loading: true,
    error: '',
  })

  const [filters, setFilters] = useState({
    search: '',
    tags: [],
    minRating: '800',
    maxRating: '1600',
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
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (String(item).trim()) {
            params.append(key, String(item).trim())
          }
        })
        return
      }

      if (String(value).trim()) {
        params.set(key, String(value).trim())
      }
    })
    params.set('limit', String(PROBLEM_PAGE_SIZE))

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

  function goToProblemPage(page) {
    const nextFilters = {
      ...filters,
      page: String(page),
    }
    setFilters(nextFilters)
    loadProblems(nextFilters)
  }

  function toggleProblemTag(tag) {
    setFilters((currentFilters) => {
      const selectedTags = new Set(currentFilters.tags)

      if (selectedTags.has(tag)) {
        selectedTags.delete(tag)
      } else {
        selectedTags.add(tag)
      }

      return {
        ...currentFilters,
        tags: [...selectedTags],
        page: '1',
      }
    })
  }

  const dashboardSummary = dashboard?.submissionSummary
  const tagEntries = useMemo(
    () => toEntries(dashboardSummary?.solvedByTag).slice(0, 10),
    [dashboardSummary],
  )
  const ratingEntries = useMemo(
    () => getRatingBand(toEntries(dashboardSummary?.solvedByRating)).slice(0, 8),
    [dashboardSummary],
  )

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

  const topicChartData = useMemo(() => {
    return tagEntries.slice(0, 8).map(([topic, solved]) => ({
      topic,
      solved,
    }))
  }, [tagEntries])

  const ratingChartData = useMemo(() => {
    return ratingEntries.map(([band, solved]) => ({
      band,
      solved,
    }))
  }, [ratingEntries])

  const attemptChartData = useMemo(() => {
    const solved = dashboardSummary?.solvedCount ?? 0
    const unsolved = dashboardSummary?.unsolvedAttemptedCount ?? 0

    return [
      { name: 'Solved', value: solved },
      { name: 'Unsolved attempted', value: unsolved },
    ].filter((entry) => entry.value > 0)
  }, [dashboardSummary])

  const prepFlow = [
    {
      label: 'Submissions',
      value: dashboardSummary?.totalSubmissions ?? 0,
    },
    {
      label: 'Unique attempted',
      value: dashboardSummary?.attemptedCount ?? 0,
    },
    {
      label: 'Solved',
      value: dashboardSummary?.solvedCount ?? 0,
    },
    {
      label: 'In tracker',
      value: trackedSummary.total,
    },
    {
      label: 'Revision',
      value: trackedSummary.revision,
    },
  ]

  const syncAction = (
    <form
      className="sync-command"
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
      <button className="solid-button" disabled={dashboardState.loading}>
        {dashboardState.loading ? (
          <Loader2 className="spin" size={15} />
        ) : (
          <RefreshCcw size={15} />
        )}
        Sync
      </button>
    </form>
  )

  return (
    <main className="workspace-shell">
      <aside className="nav-rail" aria-label="CodeArena navigation">
        <div className="workspace-brand">
          <span>C</span>
          <div>
            <strong>CodeArena</strong>
            <em>Codeforces prep</em>
          </div>
        </div>

        <nav className="workspace-nav">
          <button
            className={activeView === 'inbox' ? 'active' : ''}
            onClick={() => navigateToView('inbox')}
            type="button"
          >
            <span>Practice Inbox</span>
            <strong>{trackedSummary.inbox}</strong>
          </button>
          <button
            className={activeView === 'discovery' ? 'active' : ''}
            onClick={() => navigateToView('discovery')}
            type="button"
          >
            <span>Problem Discovery</span>
            <strong>{problemData?.count ?? 0}</strong>
          </button>
          <button
            className={activeView === 'insights' ? 'active' : ''}
            onClick={() => navigateToView('insights')}
            type="button"
          >
            <span>Profile Insights</span>
            <strong>{tagEntries.length}</strong>
          </button>
          <button
            className={activeView === 'revision' ? 'active' : ''}
            onClick={() => navigateToView('revision')}
            type="button"
          >
            <span>Revision Log</span>
            <strong>{trackedSummary.revision}</strong>
          </button>
        </nav>

        <div className="rail-footer">
          <div className="account-dot">
            {(activeHandle || 'u').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{activeHandle}</strong>
            <span>
              {dashboard?.profile?.rating ?? 'unrated'} rating /{' '}
              {formatShortDate(dashboard?.syncedAt)}
            </span>
          </div>
        </div>
      </aside>

      <section className="main-feed">
        {(dashboardState.error || problemState.error || trackedState.error) && (
          <div className="error-stack">
            {[dashboardState.error, problemState.error, trackedState.error]
              .filter(Boolean)
              .map((error) => (
                <span key={error}>{error}</span>
              ))}
          </div>
        )}

        {activeView === 'inbox' && (
          <section className="screen-view">
            <ScreenHeader
              action={syncAction}
              body="Problems you have chosen to solve next. Revision items are moved out into their own log."
              eyebrow="Workspace / Practice"
              title="Practice Inbox"
            />

            <section className="profile-line">
              <div>
                <span>Inbox</span>
                <strong>{trackedSummary.inbox}</strong>
              </div>
              <div>
                <span>Solved</span>
                <strong>{trackedSummary.solved}</strong>
              </div>
              <div>
                <span>Attempted</span>
                <strong>{formatNumber(dashboardSummary?.attemptedCount)}</strong>
              </div>
              <div>
                <span>Rating</span>
                <strong>{dashboard?.profile?.rating ?? 'Unrated'}</strong>
              </div>
            </section>

            <div className="task-list">
              {inboxProblems.map((problem) => (
                <article className="task-row" key={problem.id}>
                  <button
                    className={`check-button ${getStatusClass(problem.status)}`}
                    onClick={() =>
                      updateTrackedProblem(problem.id, {
                        status:
                          problem.status === 'Solved' ? 'Attempted' : 'Solved',
                      })
                    }
                    title="Toggle solved"
                    type="button"
                  >
                    <Check size={13} />
                  </button>
                  <div className="task-copy">
                    <a href={problem.url} rel="noreferrer" target="_blank">
                      {problem.title}
                      <ExternalLink size={12} />
                    </a>
                    <span>
                      {problem.externalId} / {problem.rating ?? 'Unrated'} /{' '}
                      {getProblemTopic(problem)}
                    </span>
                  </div>
                  <select
                    onChange={(event) =>
                      updateTrackedProblem(problem.id, {
                        status: event.target.value,
                      })
                    }
                    value={problem.status}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <select
                    onChange={(event) =>
                      updateTrackedProblem(problem.id, {
                        queue: event.target.value,
                      })
                    }
                    value={problem.queue}
                  >
                    {QUEUE_OPTIONS.map((queue) => (
                      <option key={queue}>{queue}</option>
                    ))}
                  </select>
                </article>
              ))}

              {inboxProblems.length === 0 && (
                <EmptyState
                  body="Track a problem from Discovery and it will appear here."
                  title="Practice inbox is empty"
                />
              )}
            </div>
          </section>
        )}

        {activeView === 'discovery' && (
          <section className="screen-view">
            <ScreenHeader
              action={
                <button
                  className="ghost-button"
                  disabled={problemState.loading}
                  onClick={refreshProblemCache}
                  type="button"
                >
                  <DatabaseZap size={15} />
                  Refresh cache
                </button>
              }
              body="Search Codeforces by topic, rating, or title and send problems into your practice inbox."
              eyebrow="Workspace / Discovery"
              title="Problem Discovery"
            />

            <form
              className="search-line"
              onSubmit={(event) => {
                event.preventDefault()
                const nextFilters = { ...filters, page: '1' }
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
                      page: '1',
                    }))
                  }
                  placeholder="watermelon, 4-A, graphs"
                  value={filters.search}
                />
              </label>
              <div className="tag-filter">
                <span>Tags</span>
                <details className="tag-multiselect">
                  <summary>{formatTagSummary(filters.tags)}</summary>
                  <div className="tag-menu">
                    <div className="tag-menu-head">
                      <strong>Codeforces tags</strong>
                      <button
                        disabled={filters.tags.length === 0}
                        onClick={() =>
                          setFilters((currentFilters) => ({
                            ...currentFilters,
                            tags: [],
                            page: '1',
                          }))
                        }
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="tag-menu-options">
                      {CODEFORCES_TAG_OPTIONS.map((tag) => (
                        <label key={tag}>
                          <input
                            checked={filters.tags.includes(tag)}
                            onChange={() => toggleProblemTag(tag)}
                            type="checkbox"
                            value={tag}
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
              <label>
                <span>Min</span>
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setFilters((currentFilters) => ({
                      ...currentFilters,
                      minRating: event.target.value,
                      page: '1',
                    }))
                  }
                  value={filters.minRating}
                />
              </label>
              <label>
                <span>Max</span>
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    setFilters((currentFilters) => ({
                      ...currentFilters,
                      maxRating: event.target.value,
                      page: '1',
                    }))
                  }
                  value={filters.maxRating}
                />
              </label>
              <button className="solid-button" disabled={problemState.loading}>
                {problemState.loading ? (
                  <Loader2 className="spin" size={15} />
                ) : (
                  <Search size={15} />
                )}
                Search
              </button>
            </form>

            <div className="problem-results-title">
              <h2>Search Results</h2>
              {problemData && (
                <span>
                  {problemData.count} shown /{' '}
                  {formatNumber(problemData.totalMatched)} matched
                </span>
              )}
            </div>

            <div className="problem-card-grid">
              {problemState.loading && (
                <EmptyState title="Searching" body="Loading matching problems." />
              )}

              {!problemState.loading &&
                (problemData?.problems ?? []).map((problem) => {
                  const alreadyTracked = trackedExternalIds.has(problem.externalId)

                  return (
                    <article
                      className="problem-card"
                      key={problem.externalId}
                      style={{
                        '--problem-accent': getRatingAccent(problem.rating),
                      }}
                    >
                      <div className="problem-card-head">
                        <h3>{problem.title}</h3>
                        <a
                          aria-label={`Open ${problem.externalId} on Codeforces`}
                          className="codeforces-link"
                          href={problem.url}
                          rel="noreferrer"
                          target="_blank"
                          title="Open on Codeforces"
                        >
                          <CodeforcesIcon />
                        </a>
                      </div>

                      <p className="problem-card-meta">
                        <span>{problem.rating ?? 'Unrated'}</span> /{' '}
                        {problem.tags?.slice(0, 2).join(', ') || 'untagged'}
                      </p>

                      <div className="problem-card-facts">
                        <span>
                          <strong>Source</strong>
                          {problem.platform}
                        </span>
                        <span>
                          <strong>Index</strong>
                          {problem.problemIndex}
                        </span>
                      </div>

                      <div className="tags-inline card-tags">
                        {(problem.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>

                      <footer>
                        <span>{problem.externalId}</span>
                        <button
                          className="text-button"
                          disabled={alreadyTracked || savingId === problem.externalId}
                          onClick={() => trackProblem(problem, 'Today')}
                          type="button"
                        >
                          {savingId === problem.externalId ? (
                            <Loader2 className="spin" size={14} />
                          ) : alreadyTracked ? (
                            <Check size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                          {alreadyTracked ? 'Tracked' : 'Add'}
                        </button>
                      </footer>
                    </article>
                  )
                })}

              {!problemState.loading && problemData?.problems?.length === 0 && (
                <EmptyState
                  body="Try a wider rating range or another tag."
                  title="No matching problems"
                />
              )}
            </div>

            {problemData && (
              <div className="pagination-bar">
                <span>
                  Showing {problemData.count} of{' '}
                  {formatNumber(problemData.totalMatched)} matches
                </span>
                <div>
                  <button
                    className="ghost-button"
                    disabled={problemState.loading || !problemData.hasPreviousPage}
                    onClick={() => goToProblemPage(problemData.page - 1)}
                    type="button"
                  >
                    Previous
                  </button>
                  <div className="page-list">
                    {getVisiblePages(problemData.page, problemData.totalPages).map(
                      (page, index, pages) => (
                        <span className="page-cluster" key={page}>
                          {index > 0 && page - pages[index - 1] > 1 && (
                            <em>...</em>
                          )}
                          <button
                            className={
                              page === problemData.page
                                ? 'page-button active'
                                : 'page-button'
                            }
                            disabled={problemState.loading}
                            onClick={() => goToProblemPage(page)}
                            type="button"
                          >
                            {page}
                          </button>
                        </span>
                      ),
                    )}
                  </div>
                  <button
                    className="ghost-button"
                    disabled={problemState.loading || !problemData.hasNextPage}
                    onClick={() => goToProblemPage(problemData.page + 1)}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {activeView === 'insights' && (
          <section className="screen-view">
            <ScreenHeader
              action={syncAction}
              body="Animated charts from synced Codeforces activity: topic coverage, rating bands, and solved-vs-unsolved attempts."
              eyebrow="Workspace / Analytics"
              title="Profile Insights"
            />

            <section className="profile-line">
              <div>
                <span>Rating</span>
                <strong>{dashboard?.profile?.rating ?? 'Unrated'}</strong>
              </div>
              <div>
                <span>Solved</span>
                <strong>{formatNumber(dashboardSummary?.solvedCount)}</strong>
              </div>
              <div>
                <span>Attempted</span>
                <strong>{formatNumber(dashboardSummary?.attemptedCount)}</strong>
              </div>
              <div>
                <span>Unsolved</span>
                <strong>{dashboardSummary?.unsolvedAttemptedCount ?? 0}</strong>
              </div>
            </section>

            <div className="analytics-grid">
              <section className="analytics-card profile-cardless">
                <div className="chart-heading">
                  <span>Profile snapshot</span>
                  <strong>{dashboard?.profile?.rating ?? 'Unrated'}</strong>
                </div>
                <h2>{dashboard?.profile?.handle ?? activeHandle}</h2>
                <p className="profile-rank">
                  {dashboard?.profile?.rank ?? 'Codeforces user'}
                </p>
                <p>Synced {formatShortDate(dashboard?.syncedAt)} from Codeforces.</p>
                <InsightRow
                  label="Max rating"
                  value={dashboard?.profile?.maxRating ?? '-'}
                />
                <InsightRow
                  label="Tracked problems"
                  value={trackedSummary.total}
                />
                <InsightRow label="Tracked solved" value={trackedSummary.solved} />
              </section>

              <section className="analytics-card analytics-card-wide">
                <div className="chart-heading">
                  <span>Topic-wise solved</span>
                  <strong>{formatNumber(topicChartData.length)} topics</strong>
                </div>
                <div className="chart-frame">
                  {topicChartData.length > 0 ? (
                    <ResponsiveContainer height={290} width="100%">
                      <BarChart
                        data={topicChartData}
                        layout="vertical"
                        margin={{ bottom: 8, left: 8, right: 24, top: 8 }}
                      >
                        <CartesianGrid horizontal={false} stroke="#e7e5e4" />
                        <XAxis
                          allowDecimals={false}
                          axisLine={false}
                          tick={{ fill: '#78716c', fontSize: 11 }}
                          tickLine={false}
                          type="number"
                        />
                        <YAxis
                          axisLine={false}
                          dataKey="topic"
                          tick={{ fill: '#78716c', fontSize: 11 }}
                          tickLine={false}
                          type="category"
                          width={126}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={false} />
                        <Bar
                          animationDuration={900}
                          dataKey="solved"
                          fill="#111111"
                          isAnimationActive
                          name="Solved"
                          radius={[0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState body="Sync a handle first." title="No topic data" />
                  )}
                </div>
              </section>

              <section className="analytics-card">
                <div className="chart-heading">
                  <span>Rating bands</span>
                  <strong>{formatNumber(ratingChartData.length)} bands</strong>
                </div>
                <div className="chart-frame">
                  {ratingChartData.length > 0 ? (
                    <ResponsiveContainer height={270} width="100%">
                      <BarChart
                        data={ratingChartData}
                        layout="vertical"
                        margin={{ bottom: 8, left: 2, right: 24, top: 8 }}
                      >
                        <CartesianGrid horizontal={false} stroke="#e7e5e4" />
                        <XAxis
                          allowDecimals={false}
                          axisLine={false}
                          tick={{ fill: '#78716c', fontSize: 11 }}
                          tickLine={false}
                          type="number"
                        />
                        <YAxis
                          axisLine={false}
                          dataKey="band"
                          tick={{ fill: '#78716c', fontSize: 11 }}
                          tickLine={false}
                          type="category"
                          width={76}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={false} />
                        <Bar
                          animationDuration={900}
                          dataKey="solved"
                          fill="#57534e"
                          isAnimationActive
                          name="Solved"
                          radius={[0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      body="Rated solves appear here."
                      title="No rating data"
                    />
                  )}
                </div>
              </section>

              <section className="analytics-card">
                <div className="chart-heading">
                  <span>Attempts split</span>
                  <strong>{formatNumber(dashboardSummary?.attemptedCount)}</strong>
                </div>
                <div className="donut-wrap">
                  {attemptChartData.length > 0 ? (
                    <>
                      <ResponsiveContainer height={250} width="100%">
                        <PieChart>
                          <Tooltip content={<ChartTooltip />} />
                          <Pie
                            animationDuration={900}
                            data={attemptChartData}
                            dataKey="value"
                            innerRadius={66}
                            isAnimationActive
                            nameKey="name"
                            outerRadius={94}
                            paddingAngle={3}
                          >
                            {attemptChartData.map((entry, index) => (
                              <Cell
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                key={entry.name}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-center">
                        <strong>{formatNumber(dashboardSummary?.solvedCount)}</strong>
                        <span>solved</span>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      body="Sync submissions to see attempt quality."
                      title="No attempt data"
                    />
                  )}
                </div>
              </section>

              <section className="analytics-card analytics-card-wide">
                <div className="chart-heading">
                  <span>Preparation flow</span>
                  <strong>{dashboard?.profile?.handle ?? activeHandle}</strong>
                </div>
                <div className="prep-flow">
                  {prepFlow.map((step, index) => (
                    <div className="flow-step" key={step.label}>
                      <span>{step.label}</span>
                      <strong>{formatNumber(step.value)}</strong>
                      {index < prepFlow.length - 1 && <ChevronRight size={16} />}
                    </div>
                  ))}
                </div>
              </section>

              <section className="analytics-card">
                <div className="chart-heading">
                  <span>Practice suggestions</span>
                  <strong>{formatNumber(recommendedProblems.length)}</strong>
                </div>
                <div className="suggestion-stack">
                  {recommendedProblems.length > 0 ? (
                    recommendedProblems.map((problem) => (
                      <button
                        disabled={savingId === problem.externalId}
                        key={problem.externalId}
                        onClick={() => trackProblem(problem, 'Today')}
                        type="button"
                      >
                        <span>
                          <strong>{problem.title}</strong>
                          <em>
                            {problem.rating ?? 'Unrated'} / {problem.reason}
                          </em>
                        </span>
                        <Plus size={14} />
                      </button>
                    ))
                  ) : (
                    <EmptyState
                      body="Use Problem Discovery to generate targeted suggestions."
                      title="No suggestions yet"
                    />
                  )}
                </div>
              </section>
            </div>
          </section>
        )}

        {activeView === 'revision' && (
          <section className="screen-view">
            <ScreenHeader
              body="Problems marked Revise or moved to the Revision queue, with mistake type, confidence, and notes."
              eyebrow="Workspace / Revision"
              title="Revision Log"
            />

            <section className="profile-line">
              <div>
                <span>Revision</span>
                <strong>{trackedSummary.revision}</strong>
              </div>
              <div>
                <span>Low confidence</span>
                <strong>{trackedSummary.lowConfidence}</strong>
              </div>
              <div>
                <span>Unsolved attempts</span>
                <strong>{dashboardSummary?.unsolvedAttemptedCount ?? 0}</strong>
              </div>
              <div>
                <span>Tracked solved</span>
                <strong>{trackedSummary.solved}</strong>
              </div>
            </section>

            <div className="revision-list">
              {revisionProblems.map((problem) => (
                <article className="revision-row" key={problem.id}>
                  <div className="revision-main">
                    <span className={`status-token ${getStatusClass(problem.status)}`}>
                      {problem.status}
                    </span>
                    <div>
                      <a href={problem.url} rel="noreferrer" target="_blank">
                        {problem.title}
                        <ExternalLink size={12} />
                      </a>
                      <span>
                        {problem.externalId} / {problem.rating ?? 'Unrated'} /{' '}
                        {getProblemTopic(problem)}
                      </span>
                    </div>
                  </div>

                  <select
                    onChange={(event) =>
                      updateTrackedProblem(problem.id, {
                        mistakeType: event.target.value || null,
                      })
                    }
                    value={problem.mistakeType ?? ''}
                  >
                    {MISTAKE_OPTIONS.map((mistake) => (
                      <option key={mistake} value={mistake}>
                        {mistake || '-'}
                      </option>
                    ))}
                  </select>

                  <select
                    onChange={(event) =>
                      updateTrackedProblem(problem.id, {
                        confidence: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    value={problem.confidence ?? ''}
                  >
                    <option value="">-</option>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ))}
                  </select>

                  <textarea
                    aria-label={`Notes for ${problem.title}`}
                    onBlur={(event) =>
                      updateTrackedProblem(problem.id, {
                        notes: event.target.value,
                      })
                    }
                    onChange={(event) => {
                      const value = event.target.value
                      setTrackedProblems((currentProblems) =>
                        currentProblems.map((currentProblem) =>
                          currentProblem.id === problem.id
                            ? { ...currentProblem, notes: value }
                            : currentProblem,
                        ),
                      )
                    }}
                    placeholder="Revision cue"
                    value={problem.notes ?? ''}
                  />

                  <button
                    className="icon-delete"
                    disabled={savingId === problem.id}
                    onClick={() => deleteTrackedProblem(problem.id)}
                    title="Remove from tracker"
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              ))}

              {revisionProblems.length === 0 && (
                <EmptyState
                  body="Mark a tracked problem as Revise or move it to Revision."
                  title="Revision log is clear"
                />
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
