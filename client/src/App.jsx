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

function InsightRow({ label, value }) {
  return (
    <div className="insight-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TopicMeter({ label, count, maxCount }) {
  return (
    <article className="topic-meter">
      <div>
        <span>{label}</span>
        <strong>{count}</strong>
      </div>
      <i>
        <b style={{ width: `${(count / maxCount) * 100}%` }} />
      </i>
    </article>
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
    tag: '',
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
              <label>
                <span>Tag</span>
                <input
                  onChange={(event) =>
                    setFilters((currentFilters) => ({
                      ...currentFilters,
                      tag: event.target.value,
                      page: '1',
                    }))
                  }
                  placeholder="dp"
                  value={filters.tag}
                />
              </label>
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
              <label>
                <span>Rows</span>
                <select
                  onChange={(event) => {
                    const nextFilters = {
                      ...filters,
                      limit: event.target.value,
                      page: '1',
                    }
                    setFilters(nextFilters)
                    loadProblems(nextFilters)
                  }}
                  value={filters.limit}
                >
                  <option value="20">20</option>
                  <option value="40">40</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
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
                    <article className="problem-card" key={problem.externalId}>
                      <div className="problem-card-head">
                        <a href={problem.url} rel="noreferrer" target="_blank">
                          {problem.externalId} -{' '}
                          {problem.title}
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      <p className="problem-card-meta">
                        {problem.rating ?? 'Unrated'} /{' '}
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
              body="A compact profile summary built from your synced Codeforces submissions and rating history."
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

            <div className="insights-grid">
              <section className="profile-cardless">
                <span className="rail-label">Profile</span>
                <h2>{dashboard?.profile?.handle ?? activeHandle}</h2>
                <p>{dashboard?.profile?.rank ?? 'Codeforces user'}</p>
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

              <section className="rail-section">
                <div className="rail-heading">
                  <span>Topics</span>
                  <strong>{tagEntries.length}</strong>
                </div>
                <div className="topic-stack">
                  {tagEntries.map(([tag, count]) => (
                    <TopicMeter
                      count={count}
                      key={tag}
                      label={tag}
                      maxCount={tagEntries[0]?.[1] || 1}
                    />
                  ))}
                  {tagEntries.length === 0 && (
                    <EmptyState body="Sync a handle first." title="No topic data" />
                  )}
                </div>
              </section>

              <section className="rail-section">
                <div className="rail-heading">
                  <span>Ratings</span>
                  <strong>{ratingEntries.length}</strong>
                </div>
                <div className="rating-stack">
                  {ratingEntries.map(([band, count]) => (
                    <a href="#discovery" key={band}>
                      <span>{band}</span>
                      <strong>{count}</strong>
                      <ChevronRight size={13} />
                    </a>
                  ))}
                  {ratingEntries.length === 0 && (
                    <EmptyState
                      body="Rated solves appear here."
                      title="No rating data"
                    />
                  )}
                </div>
              </section>

              <section className="rail-section">
                <div className="rail-heading">
                  <span>Suggested from search</span>
                  <strong>{recommendedProblems.length}</strong>
                </div>
                <div className="suggestion-stack">
                  {recommendedProblems.map((problem) => (
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
                  ))}
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
