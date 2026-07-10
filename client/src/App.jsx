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

function App() {
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
      await loadProblems()
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

  async function trackProblem(problem) {
    setSavingId(problem.externalId)

    try {
      await apiRequest('/api/problems', {
        method: 'POST',
        body: JSON.stringify({
          ...problem,
          status: 'Planned',
          queue: 'Today',
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

  const dashboardSummary = dashboard?.submissionSummary
  const tagEntries = useMemo(
    () => toEntries(dashboardSummary?.solvedByTag).slice(0, 8),
    [dashboardSummary],
  )
  const ratingEntries = useMemo(
    () => getRatingBand(toEntries(dashboardSummary?.solvedByRating)).slice(0, 6),
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

    return {
      total: trackedProblems.length,
      today: trackedProblems.filter((problem) => problem.queue === 'Today').length,
      revision: revisionProblems.length,
      solved: solvedProblems.length,
      lowConfidence: lowConfidence.length,
    }
  }, [trackedProblems])

  const trackedExternalIds = useMemo(() => {
    return new Set(trackedProblems.map((problem) => problem.externalId))
  }, [trackedProblems])

  const todaysProblems = useMemo(() => {
    return trackedProblems.filter((problem) => problem.queue === 'Today')
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

  return (
    <main className="workspace-shell">
      <aside className="nav-rail" aria-label="CodeArena navigation">
        <div className="workspace-brand">
          <span>CA</span>
          <div>
            <strong>CodeArena</strong>
            <em>Placement prep</em>
          </div>
        </div>

        <nav className="workspace-nav">
          <a href="#today">
            <span>Today</span>
            <strong>{trackedSummary.today}</strong>
          </a>
          <a href="#discovery">
            <span>Discover</span>
            <strong>{problemData?.count ?? 0}</strong>
          </a>
          <a href="#revision">
            <span>Revision</span>
            <strong>{trackedSummary.revision}</strong>
          </a>
          <a href="#analytics">
            <span>Analytics</span>
            <strong>{tagEntries.length}</strong>
          </a>
        </nav>

        <div className="rail-footer">
          <span>Synced profile</span>
          <strong>{activeHandle}</strong>
          <em>{formatShortDate(dashboard?.syncedAt)}</em>
        </div>
      </aside>

      <section className="main-feed">
        <header className="feed-header">
          <div>
            <span className="breadcrumb">Codeforces / Workspace</span>
            <h1>Practice inbox</h1>
          </div>

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
        </header>

        {(dashboardState.error || problemState.error || trackedState.error) && (
          <div className="error-stack">
            {[dashboardState.error, problemState.error, trackedState.error]
              .filter(Boolean)
              .map((error) => (
                <span key={error}>{error}</span>
              ))}
          </div>
        )}

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
            <span>Tracked</span>
            <strong>{trackedSummary.total}</strong>
          </div>
        </section>

        <section className="feed-section" id="today">
          <div className="feed-title">
            <div>
              <span>Planner</span>
              <h2>Today</h2>
            </div>
            <p>{trackedSummary.today} active problems</p>
          </div>

          <div className="task-list">
            {todaysProblems.map((problem) => (
              <article className="task-row" key={problem.id}>
                <button
                  className={`check-button ${getStatusClass(problem.status)}`}
                  onClick={() =>
                    updateTrackedProblem(problem.id, {
                      status: problem.status === 'Solved' ? 'Attempted' : 'Solved',
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

            {todaysProblems.length === 0 && (
              <EmptyState
                body="Track a problem from discovery and it will show up here."
                title="Nothing planned for today"
              />
            )}
          </div>
        </section>

        <section className="feed-section" id="discovery">
          <div className="feed-title">
            <div>
              <span>Discovery</span>
              <h2>Find problems</h2>
            </div>
            <button
              className="ghost-button"
              disabled={problemState.loading}
              onClick={refreshProblemCache}
              type="button"
            >
              <DatabaseZap size={15} />
              Refresh cache
            </button>
          </div>

          <form
            className="search-line"
            onSubmit={(event) => {
              event.preventDefault()
              loadProblems(filters)
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
                inputMode="numeric"
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
                inputMode="numeric"
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    maxRating: event.target.value,
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

          <div className="problem-feed">
            {problemState.loading && (
              <EmptyState title="Searching" body="Loading matching problems." />
            )}

            {!problemState.loading &&
              (problemData?.problems ?? []).map((problem) => {
                const alreadyTracked = trackedExternalIds.has(problem.externalId)

                return (
                  <article className="problem-item" key={problem.externalId}>
                    <div className="problem-meta">
                      <a href={problem.url} rel="noreferrer" target="_blank">
                        {problem.title}
                        <ExternalLink size={12} />
                      </a>
                      <span>
                        {problem.externalId} / {problem.rating ?? 'Unrated'}
                      </span>
                    </div>
                    <div className="tags-inline">
                      {(problem.tags ?? []).slice(0, 3).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <button
                      className="text-button"
                      disabled={alreadyTracked || savingId === problem.externalId}
                      onClick={() => trackProblem(problem)}
                      type="button"
                    >
                      {savingId === problem.externalId ? (
                        <Loader2 className="spin" size={14} />
                      ) : alreadyTracked ? (
                        <Check size={14} />
                      ) : (
                        <Plus size={14} />
                      )}
                      {alreadyTracked ? 'Tracked' : 'Track'}
                    </button>
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
        </section>

        <section className="feed-section" id="revision">
          <div className="feed-title">
            <div>
              <span>Revision</span>
              <h2>Mistake log</h2>
            </div>
            <p>{trackedSummary.lowConfidence} low-confidence items</p>
          </div>

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
                      {problem.mistakeType || 'No mistake type'} / Confidence{' '}
                      {problem.confidence ?? '-'}
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
                body="Mark a tracked problem as Revise to create your revision list."
                title="Revision list is clear"
              />
            )}
          </div>
        </section>
      </section>

      <aside className="insights-rail" id="analytics">
        <section className="profile-cardless">
          <span className="rail-label">Profile</span>
          <h2>{dashboard?.profile?.handle ?? activeHandle}</h2>
          <p>{dashboard?.profile?.rank ?? 'Codeforces user'}</p>
          <InsightRow
            label="Max rating"
            value={dashboard?.profile?.maxRating ?? '-'}
          />
          <InsightRow
            label="Unsolved attempts"
            value={dashboardSummary?.unsolvedAttemptedCount ?? 0}
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
              <EmptyState body="Rated solves appear here." title="No rating data" />
            )}
          </div>
        </section>

        <section className="rail-section">
          <div className="rail-heading">
            <span>Suggested</span>
            <strong>{recommendedProblems.length}</strong>
          </div>
          <div className="suggestion-stack">
            {recommendedProblems.map((problem) => (
              <button
                disabled={savingId === problem.externalId}
                key={problem.externalId}
                onClick={() => trackProblem(problem)}
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
      </aside>
    </main>
  )
}

export default App
