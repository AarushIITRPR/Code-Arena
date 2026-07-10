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
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function Metric({ label, value, helper }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  )
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
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
    () => toEntries(dashboardSummary?.solvedByTag).slice(0, 9),
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
      .slice(0, 5)
  }, [problemData, tagEntries, trackedExternalIds])

  return (
    <main className="codearena-shell">
      <aside className="side-panel" aria-label="CodeArena navigation">
        <div className="brand-row">
          <div className="brand-mark">CA</div>
          <div>
            <strong>CodeArena</strong>
            <span>Practice OS</span>
          </div>
        </div>

        <nav className="main-nav">
          <a href="#overview">Overview</a>
          <a href="#discovery">Discovery</a>
          <a href="#tracker">Tracker</a>
          <a href="#analytics">Analytics</a>
        </nav>

        <div className="sync-panel">
          <span>Connected handle</span>
          <strong>{activeHandle || '-'}</strong>
          <p>{formatShortDate(dashboard?.syncedAt)}</p>
        </div>
      </aside>

      <section className="workbench">
        <header className="workspace-header" id="overview">
          <div>
            <p className="kicker">Codeforces workspace</p>
            <h1>Placement practice</h1>
            <p>
              Search problems, sync submissions, and keep a compact revision log
              from one screen.
            </p>
          </div>

          <form
            className="handle-command"
            onSubmit={(event) => {
              event.preventDefault()
              loadDashboard(handleInput, true)
            }}
          >
            <label>
              <span>Handle</span>
              <input
                aria-label="Codeforces handle"
                onChange={(event) => setHandleInput(event.target.value)}
                placeholder="tourist"
                value={handleInput}
              />
            </label>
            <button className="button dark" disabled={dashboardState.loading}>
              {dashboardState.loading ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <RefreshCcw size={16} />
              )}
              Sync
            </button>
          </form>
        </header>

        {dashboardState.error && (
          <div className="error-line">{dashboardState.error}</div>
        )}

        <section className="metric-strip" aria-label="Practice summary">
          <Metric
            helper="Accepted in synced submissions"
            label="Solved"
            value={formatNumber(dashboardSummary?.solvedCount)}
          />
          <Metric
            helper="Unique problems attempted"
            label="Attempted"
            value={formatNumber(dashboardSummary?.attemptedCount)}
          />
          <Metric
            helper={`${trackedSummary.today} today / ${trackedSummary.revision} revision`}
            label="Tracked"
            value={formatNumber(trackedSummary.total)}
          />
          <Metric
            helper={dashboard?.profile?.rank ?? 'Codeforces profile'}
            label="Rating"
            value={dashboard?.profile?.rating ?? 'Unrated'}
          />
        </section>

        <div className="upper-grid" id="analytics">
          <section className="module topic-module">
            <SectionHeader
              action={
                <span className="quiet-chip">
                  {dashboard?.fromCache ? 'cached' : 'fresh'} snapshot
                </span>
              }
              eyebrow="Analytics"
              title="Solved topics"
            />

            {dashboardState.loading ? (
              <EmptyState body="Fetching activity data." title="Loading profile" />
            ) : tagEntries.length > 0 ? (
              <div className="topic-table">
                {tagEntries.map(([tag, count]) => {
                  const maxCount = tagEntries[0]?.[1] || 1

                  return (
                    <article className="topic-row" key={tag}>
                      <span>{tag}</span>
                      <div>
                        <i style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
                      <strong>{count}</strong>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                body="Sync a handle with public submissions to see topic data."
                title="No topic data yet"
              />
            )}
          </section>

          <aside className="module side-stack">
            <SectionHeader eyebrow="Range" title="Rating bands" />

            {ratingEntries.length > 0 ? (
              <div className="band-list">
                {ratingEntries.map(([band, count]) => (
                  <article key={band}>
                    <span>{band}</span>
                    <strong>{count}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                body="Rated solves will be grouped here."
                title="No rated solves"
              />
            )}
          </aside>
        </div>

        <section className="module discovery-module" id="discovery">
          <SectionHeader
            action={
              <button
                className="icon-button"
                disabled={problemState.loading}
                onClick={refreshProblemCache}
                title="Refresh Codeforces cache"
                type="button"
              >
                <DatabaseZap size={16} />
              </button>
            }
            eyebrow="Discovery"
            title="Codeforces problemset"
          />

          <form
            className="filter-toolbar"
            onSubmit={(event) => {
              event.preventDefault()
              loadProblems(filters)
            }}
          >
            <label className="search-field">
              <span>Search</span>
              <input
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    search: event.target.value,
                  }))
                }
                placeholder="watermelon, dp, 4-A"
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
                placeholder="graphs"
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
            <button className="button light" disabled={problemState.loading}>
              {problemState.loading ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Search size={16} />
              )}
              Search
            </button>
          </form>

          {problemState.error && <div className="error-line">{problemState.error}</div>}

          <div className="split-pane">
            <div className="data-table problem-table">
              <div className="table-row table-head">
                <span>Problem</span>
                <span>Rating</span>
                <span>Tags</span>
                <span />
              </div>

              {problemState.loading && (
                <EmptyState title="Searching" body="Loading matching problems." />
              )}

              {!problemState.loading &&
                (problemData?.problems ?? []).map((problem) => {
                  const alreadyTracked = trackedExternalIds.has(problem.externalId)

                  return (
                    <article className="table-row problem-row" key={problem.externalId}>
                      <div>
                        <a href={problem.url} rel="noreferrer" target="_blank">
                          {problem.title}
                          <ExternalLink size={13} />
                        </a>
                        <span>{problem.externalId}</span>
                      </div>
                      <strong>{problem.rating ?? 'Unrated'}</strong>
                      <div className="tag-line">
                        {(problem.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <button
                        className="row-action"
                        disabled={alreadyTracked || savingId === problem.externalId}
                        onClick={() => trackProblem(problem)}
                        title="Add to tracker"
                        type="button"
                      >
                        {savingId === problem.externalId ? (
                          <Loader2 className="spin" size={15} />
                        ) : alreadyTracked ? (
                          <Check size={15} />
                        ) : (
                          <Plus size={15} />
                        )}
                        {alreadyTracked ? 'Tracked' : 'Track'}
                      </button>
                    </article>
                  )
                })}

              {!problemState.loading && problemData?.problems?.length === 0 && (
                <EmptyState
                  body="Try a wider rating range or a different tag."
                  title="No matching problems"
                />
              )}
            </div>

            <aside className="recommendation-panel">
              <h3>Suggested from search</h3>
              <div className="suggestion-list">
                {recommendedProblems.map((problem) => (
                  <button
                    className="suggestion-row"
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
                    <ChevronRight size={15} />
                  </button>
                ))}

                {recommendedProblems.length === 0 && (
                  <EmptyState
                    body="Search results that are not already tracked will appear here."
                    title="No suggestions"
                  />
                )}
              </div>
            </aside>
          </div>
        </section>

        <section className="module tracker-module" id="tracker">
          <SectionHeader
            action={
              <div className="tracker-counts">
                <span>{trackedSummary.today} today</span>
                <span>{trackedSummary.revision} revision</span>
                <span>{trackedSummary.lowConfidence} low confidence</span>
              </div>
            }
            eyebrow="Tracker"
            title="Practice log"
          />

          {trackedState.error && <div className="error-line">{trackedState.error}</div>}

          <div className="tracker-list">
            {trackedState.loading && (
              <EmptyState title="Loading tracker" body="Fetching saved problems." />
            )}

            {!trackedState.loading &&
              trackedProblems.map((problem) => (
                <article className="tracker-row" key={problem.id}>
                  <div className="tracker-title">
                    <a href={problem.url} rel="noreferrer" target="_blank">
                      {problem.title}
                      <ExternalLink size={13} />
                    </a>
                    <span>
                      {problem.externalId} / {problem.rating ?? 'Unrated'} /{' '}
                      {getProblemTopic(problem)}
                    </span>
                  </div>

                  <span className={`status-pill ${getStatusClass(problem.status)}`}>
                    {problem.status}
                  </span>

                  <label>
                    <span>Status</span>
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
                  </label>

                  <label>
                    <span>Queue</span>
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
                  </label>

                  <label>
                    <span>Confidence</span>
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
                  </label>

                  <label>
                    <span>Mistake</span>
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
                  </label>

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
                    placeholder="Mistake note or revision cue"
                    value={problem.notes ?? ''}
                  />

                  <button
                    className="icon-button danger"
                    disabled={savingId === problem.id}
                    onClick={() => deleteTrackedProblem(problem.id)}
                    title="Remove from tracker"
                    type="button"
                  >
                    {savingId === problem.id ? (
                      <Loader2 className="spin" size={15} />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </article>
              ))}

            {!trackedState.loading && trackedProblems.length === 0 && (
              <EmptyState
                body="Track a problem from discovery to start building your practice plan."
                title="No tracked problems"
              />
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
