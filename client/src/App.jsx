import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  ListChecks,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Target,
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
  const numericEntries = entries
    .filter(([rating]) => rating !== 'unrated')
    .map(([rating, count]) => [Number(rating), count])
    .sort(([firstRating], [secondRating]) => firstRating - secondRating)

  if (numericEntries.length === 0) {
    return []
  }

  const bands = new Map()

  numericEntries.forEach(([rating, count]) => {
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

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="stat-card">
      <div className="stat-card__icon">
        <Icon size={18} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  )
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
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
    () => toEntries(dashboardSummary?.solvedByTag).slice(0, 8),
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
          ? 'Build consistency'
          : 'Broaden coverage',
      }))
      .slice(0, 6)
  }, [problemData, tagEntries, trackedExternalIds])

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="CodeArena navigation">
        <div className="brand-lockup">
          <div className="brand-mark">CA</div>
          <div>
            <p>CodeArena</p>
            <span>Placement prep workspace</span>
          </div>
        </div>

        <nav className="side-nav">
          <a href="#overview">Overview</a>
          <a href="#discovery">Discovery</a>
          <a href="#tracker">Tracker</a>
          <a href="#analytics">Analytics</a>
        </nav>

        <section className="sync-card" aria-label="Current Codeforces sync">
          <span>Codeforces handle</span>
          <strong>{activeHandle || 'Not selected'}</strong>
          <p>
            {dashboard?.syncedAt
              ? `Last sync ${formatShortDate(dashboard.syncedAt)}`
              : 'Waiting for first sync'}
          </p>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar" id="overview">
          <div>
            <p className="eyebrow">CodeArena V1</p>
            <h1>Practice planning from real Codeforces activity.</h1>
          </div>

          <form
            className="handle-form"
            onSubmit={(event) => {
              event.preventDefault()
              loadDashboard(handleInput, true)
            }}
          >
            <input
              aria-label="Codeforces handle"
              onChange={(event) => setHandleInput(event.target.value)}
              placeholder="Codeforces handle"
              value={handleInput}
            />
            <button
              className="button button--primary"
              disabled={dashboardState.loading}
              title="Refresh profile"
              type="submit"
            >
              {dashboardState.loading ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <RefreshCcw size={17} />
              )}
              Sync
            </button>
          </form>
        </header>

        {dashboardState.error && (
          <div className="inline-error">{dashboardState.error}</div>
        )}

        <section className="stat-grid" aria-label="Practice snapshot">
          <StatCard
            helper="Unique accepted problems from recent submissions"
            icon={CheckCircle2}
            label="Solved"
            value={formatNumber(dashboardSummary?.solvedCount)}
          />
          <StatCard
            helper="Problems touched at least once"
            icon={Target}
            label="Attempted"
            value={formatNumber(dashboardSummary?.attemptedCount)}
          />
          <StatCard
            helper="Tracked problems waiting in your plan"
            icon={ListChecks}
            label="Queue"
            value={formatNumber(trackedSummary.total)}
          />
          <StatCard
            helper="Current Codeforces rating"
            icon={BarChart3}
            label="Rating"
            value={dashboard?.profile?.rating ?? 'Unrated'}
          />
        </section>

        <section className="content-grid">
          <section className="panel panel--large" id="analytics">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Analytics</p>
                <h2>Topic-wise solved distribution</h2>
              </div>
              <span className="meta-pill">
                {dashboard?.fromCache ? 'Cached' : 'Fresh'} snapshot
              </span>
            </div>

            {dashboardState.loading ? (
              <EmptyState title="Loading profile" body="Fetching activity data." />
            ) : tagEntries.length > 0 ? (
              <div className="bar-list">
                {tagEntries.map(([tag, count]) => {
                  const maxCount = tagEntries[0]?.[1] || 1

                  return (
                    <article className="bar-row" key={tag}>
                      <div>
                        <strong>{tag}</strong>
                        <span>{count} solved</span>
                      </div>
                      <div className="bar-track">
                        <span style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
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

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Focus</p>
                <h2>Rating bands</h2>
              </div>
            </div>

            {ratingEntries.length > 0 ? (
              <div className="rating-band-list">
                {ratingEntries.map(([band, count]) => (
                  <article key={band}>
                    <span>{band}</span>
                    <strong>{count}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                body="Rating-band charts appear after solving rated problems."
                title="No rated solves"
              />
            )}
          </section>
        </section>

        <section className="panel" id="discovery">
          <div className="panel-heading panel-heading--stacked">
            <div>
              <p className="eyebrow">Problem Discovery</p>
              <h2>Search the Codeforces problemset</h2>
            </div>

            <form
              className="filter-bar"
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
              <button
                className="button button--primary"
                disabled={problemState.loading}
                title="Search problems"
                type="submit"
              >
                {problemState.loading ? (
                  <Loader2 className="spin" size={17} />
                ) : (
                  <Search size={17} />
                )}
                Search
              </button>
              <button
                className="icon-button"
                disabled={problemState.loading}
                onClick={refreshProblemCache}
                title="Refresh Codeforces cache"
                type="button"
              >
                <DatabaseZap size={18} />
              </button>
            </form>
          </div>

          {problemState.error && (
            <div className="inline-error">{problemState.error}</div>
          )}

          <div className="problem-layout">
            <div className="problem-table">
              <div className="table-head">
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
                    <article className="problem-row" key={problem.externalId}>
                      <div>
                        <a href={problem.url} rel="noreferrer" target="_blank">
                          {problem.title}
                          <ExternalLink size={14} />
                        </a>
                        <span>{problem.externalId}</span>
                      </div>
                      <strong>{problem.rating ?? 'Unrated'}</strong>
                      <div className="tag-cluster">
                        {(problem.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <button
                        className="button button--ghost"
                        disabled={alreadyTracked || savingId === problem.externalId}
                        onClick={() => trackProblem(problem)}
                        title="Add to tracker"
                        type="button"
                      >
                        {savingId === problem.externalId ? (
                          <Loader2 className="spin" size={16} />
                        ) : (
                          <Plus size={16} />
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

            <aside className="recommendation-box">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Next picks</p>
                  <h2>Recommended from this search</h2>
                </div>
              </div>

              <div className="mini-list">
                {recommendedProblems.map((problem) => (
                  <article key={problem.externalId}>
                    <div>
                      <strong>{problem.title}</strong>
                      <span>
                        {problem.rating ?? 'Unrated'} - {problem.reason}
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      disabled={savingId === problem.externalId}
                      onClick={() => trackProblem(problem)}
                      title="Add recommended problem"
                      type="button"
                    >
                      <Plus size={16} />
                    </button>
                  </article>
                ))}

                {recommendedProblems.length === 0 && (
                  <EmptyState
                    body="Search results that are not already tracked will appear here."
                    title="No recommendations"
                  />
                )}
              </div>
            </aside>
          </div>
        </section>

        <section className="panel" id="tracker">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Practice Tracker</p>
              <h2>Revision queue and attempt log</h2>
            </div>
            <div className="tracker-summary">
              <span>{trackedSummary.today} Today</span>
              <span>{trackedSummary.revision} Revision</span>
              <span>{trackedSummary.lowConfidence} Low confidence</span>
            </div>
          </div>

          {trackedState.error && (
            <div className="inline-error">{trackedState.error}</div>
          )}

          <div className="tracker-list">
            {trackedState.loading && (
              <EmptyState title="Loading tracker" body="Fetching saved problems." />
            )}

            {!trackedState.loading &&
              trackedProblems.map((problem) => (
                <article className="tracker-row" key={problem.id}>
                  <div className="tracker-main">
                    <div>
                      <a href={problem.url} rel="noreferrer" target="_blank">
                        {problem.title}
                        <ExternalLink size={14} />
                      </a>
                      <span>
                        {problem.externalId} - {problem.rating ?? 'Unrated'} -{' '}
                        {getProblemTopic(problem)}
                      </span>
                    </div>
                    <span className={`status-dot ${getStatusClass(problem.status)}`}>
                      {problem.status}
                    </span>
                  </div>

                  <div className="tracker-controls">
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
                  </div>

                  <div className="note-row">
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
                      placeholder="Mistake note, approach reminder, or revision cue"
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
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </article>
              ))}

            {!trackedState.loading && trackedProblems.length === 0 && (
              <EmptyState
                body="Track a problem from discovery to start building your practice plan."
                title="Tracker is empty"
              />
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
