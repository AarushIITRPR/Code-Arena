import { useEffect, useMemo, useState } from 'react'
import {
  Check,
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
const PROBLEM_PAGE_SIZE = 39
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

function formatUtcDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function buildHeatmapMonths(activityByDate, monthCount = 12) {
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )

  return Array.from({ length: monthCount }, (_, monthIndex) => {
    const firstDay = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() - (monthCount - 1) + monthIndex,
        1,
      ),
    )
    const daysInMonth = new Date(
      Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0),
    ).getUTCDate()
    const leadingEmptyDays = firstDay.getUTCDay()
    const cells = Array.from({ length: 42 }, (_, cellIndex) => {
      const dayNumber = cellIndex - leadingEmptyDays + 1

      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return null
      }

      const date = new Date(
        Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), dayNumber),
      )
      const key = formatUtcDateKey(date)
      const activity = activityByDate[key] ?? {}

      return {
        key,
        date,
        isFuture: date > today,
        submissions: activity.submissions ?? 0,
        accepted: activity.accepted ?? 0,
      }
    })

    return {
      key: formatUtcDateKey(firstDay),
      label: new Intl.DateTimeFormat('en', {
        month: 'short',
        timeZone: 'UTC',
      }).format(firstDay),
      year: firstDay.getUTCFullYear(),
      submissions: cells.reduce(
        (total, day) => total + (day?.submissions ?? 0),
        0,
      ),
      cells,
    }
  })
}

function getActivityLevel(count) {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 7) return 3
  return 4
}

function getActivityMetrics(activityByDate) {
  const activeDates = new Set(
    Object.entries(activityByDate)
      .filter(([, activity]) => (activity.submissions ?? 0) > 0)
      .map(([date]) => date),
  )
  const now = new Date()
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )

  if (!activeDates.has(formatUtcDateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  let currentStreak = 0

  while (activeDates.has(formatUtcDateKey(cursor))) {
    currentStreak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return {
    activeDays: activeDates.size,
    currentStreak,
  }
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

function ActivityAtlas({ activityByDate }) {
  const months = useMemo(
    () => buildHeatmapMonths(activityByDate),
    [activityByDate],
  )
  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="activity-atlas" aria-label="Twelve month submission heatmap">
      {months.map((month, monthIndex) => (
        <article className="activity-month" key={month.key}>
          <header>
            <span>
              {month.label}
              {(monthIndex === 0 || month.label === 'Jan') && (
                <small>{month.year}</small>
              )}
            </span>
            <strong>{formatNumber(month.submissions)}</strong>
          </header>

          <div className="activity-week-key" aria-hidden="true">
            {weekdayLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>

          <div className="activity-month-grid">
            {month.cells.map((day, cellIndex) => {
              if (!day) {
                return (
                  <span
                    aria-hidden="true"
                    className="activity-day empty"
                    key={`empty-${cellIndex}`}
                  />
                )
              }

              const dateLabel = new Intl.DateTimeFormat('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(day.date)
              const activityLabel = `${dateLabel}: ${day.submissions} submissions, ${day.accepted} accepted`

              return (
                <span
                  aria-label={activityLabel}
                  className={`activity-day level-${getActivityLevel(
                    day.submissions,
                  )}${day.isFuture ? ' future' : ''}`}
                  key={day.key}
                  title={activityLabel}
                />
              )
            })}
          </div>
        </article>
      ))}
    </div>
  )
}

function ScreenHeader({ title, body, action }) {
  return (
    <header className="screen-header">
      <div>
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
        `/api/codeforces/dashboard/${encodeURIComponent(trimmedHandle)}${suffix}?count=1000`,
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

  const trackedProblemByExternalId = useMemo(() => {
    return new Map(
      trackedProblems.map((problem) => [problem.externalId, problem]),
    )
  }, [trackedProblems])

  const userAttemptByExternalId = useMemo(() => {
    const attempts = new Map()

    dashboardSummary?.unsolvedAttemptedProblems?.forEach((problem) => {
      if (problem.externalId) {
        attempts.set(problem.externalId, 'Unsolved')
      }
    })

    dashboardSummary?.solvedProblems?.forEach((problem) => {
      if (problem.externalId) {
        attempts.set(problem.externalId, 'Solved')
      }
    })

    dashboard?.recentSubmissions?.forEach((submission) => {
      const externalId = submission.problem?.externalId

      if (!externalId) {
        return
      }

      if (submission.verdict === 'OK') {
        attempts.set(externalId, 'Solved')
        return
      }

      if (!attempts.has(externalId)) {
        attempts.set(externalId, 'Unsolved')
      }
    })

    return attempts
  }, [dashboard?.recentSubmissions, dashboardSummary])

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

  const topicChartData = useMemo(() => {
    return tagEntries.map(([topic, solved]) => ({
      topic,
      solved,
    }))
  }, [tagEntries])

  const ratingChartData = useMemo(() => {
    return Object.entries(dashboardSummary?.solvedByRating ?? {})
      .filter(([rating]) => rating !== 'unrated')
      .map(([rating, solved]) => ({
        rating: Number(rating),
        solved,
      }))
      .sort((firstEntry, secondEntry) => {
        return firstEntry.rating - secondEntry.rating
      })
  }, [dashboardSummary])

  const activityByDate = useMemo(() => {
    const cachedActivity = dashboardSummary?.activityByDate

    if (cachedActivity && Object.keys(cachedActivity).length > 0) {
      return cachedActivity
    }

    return (dashboard?.recentSubmissions ?? []).reduce((activity, submission) => {
      const submissionDate = submission.submittedAt?.slice(0, 10)

      if (!submissionDate) return activity

      const dailyActivity = activity[submissionDate] ?? {
        submissions: 0,
        accepted: 0,
      }

      dailyActivity.submissions += 1

      if (submission.verdict === 'OK') {
        dailyActivity.accepted += 1
      }

      activity[submissionDate] = dailyActivity
      return activity
    }, {})
  }, [dashboard?.recentSubmissions, dashboardSummary?.activityByDate])

  const activityMetrics = useMemo(
    () => getActivityMetrics(activityByDate),
    [activityByDate],
  )
  const solveRate = dashboardSummary?.attemptedCount
    ? Math.round(
        (dashboardSummary.solvedCount / dashboardSummary.attemptedCount) * 100,
      )
    : 0
  const topTopic = topicChartData[0]
  const topRating = ratingChartData.reduce(
    (leadingEntry, entry) =>
      entry.solved > (leadingEntry?.solved ?? -1) ? entry : leadingEntry,
    null,
  )

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
          <strong>CodeArena</strong>
          <em>Practice, deliberately.</em>
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
            {dashboard?.profile?.avatar ? (
              <img
                alt={`${activeHandle} Codeforces profile`}
                src={dashboard.profile.avatar}
              />
            ) : (
              (activeHandle || 'u').slice(0, 1).toUpperCase()
            )}
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

      <section className="main-feed" data-view={activeView}>
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
          <section className="screen-view editorial-screen inbox-view">
            <ScreenHeader
              action={syncAction}
              body="A short, intentional queue of problems worth solving next."
              title="Practice Inbox"
            />

            <section className="page-narrative">
              <p>
                <em>{trackedSummary.inbox}</em> problems are waiting for a
                deliberate attempt.
              </p>
              <div>
                <span>{trackedSummary.solved} tracked problems solved</span>
                <span>
                  {formatNumber(dashboardSummary?.attemptedCount)} attempted on
                  Codeforces
                </span>
                <strong>{dashboard?.profile?.rating ?? 'Unrated'} rating</strong>
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
                  <label className="task-control">
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
                  <label className="task-control">
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
          <section className="screen-view editorial-screen discovery-view">
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
              body="Search Codeforces by topic, rating, or title, then keep only what deserves your attention."
              title="Find your next problem."
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
              <h2>Matching problems</h2>
              {problemData && (
                <span>
                  {problemData.count} shown /{' '}
                  {formatNumber(problemData.totalMatched)} matched
                </span>
              )}
            </div>

            <div className="problem-index">
              {problemState.loading && (
                <EmptyState title="Searching" body="Loading matching problems." />
              )}

              {!problemState.loading &&
                (problemData?.problems ?? []).map((problem) => {
                  const trackedProblem = trackedProblemByExternalId.get(
                    problem.externalId,
                  )
                  const alreadyTracked = Boolean(trackedProblem)
                  const attemptStatus =
                    userAttemptByExternalId.get(problem.externalId) ??
                    'Unattempted'

                  return (
                    <article
                      className="problem-entry"
                      data-problem-id={problem.externalId}
                      key={problem.externalId}
                      style={{
                        '--problem-accent': getRatingAccent(problem.rating),
                      }}
                    >
                      <header>
                        <p className="problem-entry-identity">
                          <span>{problem.externalId}</span>
                          <strong>{problem.rating ?? 'Unrated'}</strong>
                        </p>
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
                      </header>

                      <h3>{problem.title}</h3>
                      <p
                        className="problem-entry-tags"
                        title={problem.tags.join(', ')}
                      >
                        {problem.tags.length > 0
                          ? problem.tags.slice(0, 2).join(' · ')
                          : 'untagged'}
                        {problem.tags.length > 2 && (
                          <span> +{problem.tags.length - 2}</span>
                        )}
                      </p>

                      <footer>
                        <div className="problem-entry-state">
                          <span className={getStatusClass(attemptStatus)}>
                            {attemptStatus}
                          </span>
                          {trackedProblem && <em>{trackedProblem.status}</em>}
                        </div>
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
          <section className="screen-view insights-view">
            <header className="insights-profile-header">
              <div className="insights-person">
                <div className="insights-avatar">
                  {dashboard?.profile?.avatar ? (
                    <img
                      alt={`${dashboard.profile.handle} Codeforces profile`}
                      src={dashboard.profile.avatar}
                    />
                  ) : (
                    <span>{activeHandle.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="insights-profile-meta">
                    Codeforces profile
                    <span>updated {formatShortDate(dashboard?.syncedAt)}</span>
                  </p>
                  <h1>{dashboard?.profile?.handle ?? activeHandle}</h1>
                  <p className="insights-rank">
                    {dashboard?.profile?.rank ?? 'Unrated'}
                  </p>
                </div>
              </div>

              <form
                className="insights-sync"
                onSubmit={(event) => {
                  event.preventDefault()
                  loadDashboard(handleInput, true)
                }}
              >
                <span aria-hidden="true">@</span>
                <input
                  aria-label="Codeforces handle"
                  onChange={(event) => setHandleInput(event.target.value)}
                  placeholder="Codeforces handle"
                  value={handleInput}
                />
                <button
                  aria-label="Sync Codeforces profile"
                  disabled={dashboardState.loading}
                  title="Sync Codeforces profile"
                  type="submit"
                >
                  <RefreshCcw
                    className={dashboardState.loading ? 'spin' : ''}
                    size={17}
                  />
                </button>
              </form>
            </header>

            <section className="profile-narrative">
              <p className="profile-statement">
                <em>{formatNumber(dashboardSummary?.solvedCount)}</em> unique
                problems solved, with a <em>{solveRate}%</em> solve rate.
              </p>

              <div className="rating-readout">
                <p>
                  <strong
                    style={{ color: getRatingAccent(dashboard?.profile?.rating) }}
                  >
                    {dashboard?.profile?.rating ?? 'Unrated'}
                  </strong>{' '}
                  now
                </p>
                <p>
                  <strong>{dashboard?.profile?.maxRating ?? '-'}</strong> personal
                  best
                </p>
                <span>
                  {formatNumber(dashboardSummary?.totalSubmissions)} submissions
                  across {activityMetrics.activeDays} active days
                </span>
              </div>
            </section>

            <section className="insight-chapter difficulty-chapter">
              <header className="chapter-heading">
                <div>
                  <h2>Difficulty, mapped.</h2>
                  <p>
                    Every bar is a Codeforces rating; every height is a unique
                    accepted problem.
                  </p>
                </div>
                {topRating && (
                  <p className="chapter-observation">
                    Your deepest shelf is{' '}
                    <strong style={{ color: getRatingAccent(topRating.rating) }}>
                      {topRating.rating}
                    </strong>
                    , with {formatNumber(topRating.solved)} solved.
                  </p>
                )}
              </header>

              <div className="difficulty-spectrum">
                {ratingChartData.length > 0 ? (
                  <ResponsiveContainer height={360} width="100%">
                    <BarChart
                      data={ratingChartData}
                      margin={{ bottom: 4, left: -12, right: 8, top: 26 }}
                    >
                      <CartesianGrid stroke="#e9e5ff" vertical={false} />
                      <XAxis
                        axisLine={{ stroke: '#cbc3ff' }}
                        dataKey="rating"
                        interval="preserveStartEnd"
                        minTickGap={24}
                        tick={{
                          fill: '#5f5878',
                          fontFamily: 'Manrope Variable',
                          fontSize: 10,
                        }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tick={{
                          fill: '#837c9c',
                          fontFamily: 'Manrope Variable',
                          fontSize: 10,
                        }}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: 'rgba(99, 91, 255, 0.05)' }}
                      />
                      <Bar
                        animationDuration={1100}
                        dataKey="solved"
                        isAnimationActive
                        maxBarSize={34}
                        name="Solved"
                        radius={[3, 3, 0, 0]}
                      >
                        {ratingChartData.map((entry) => (
                          <Cell
                            fill={getRatingAccent(entry.rating)}
                            key={entry.rating}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    body="Rated solves appear after a profile sync."
                    title="No rating data"
                  />
                )}
              </div>
            </section>

            <div className="insights-asymmetry">
              <section className="insight-chapter activity-chapter">
                <header className="chapter-heading chapter-heading-stacked">
                  <div>
                    <h2>A year in practice.</h2>
                    <p>
                      Twelve monthly calendars, built from the latest 1,000
                      submissions.
                    </p>
                  </div>
                  <p className="activity-summary">
                    <strong>{activityMetrics.activeDays}</strong> active days
                    <span>
                      {activityMetrics.currentStreak > 0
                        ? `${activityMetrics.currentStreak}-day current streak`
                        : 'No active streak today'}
                    </span>
                  </p>
                </header>

                <ActivityAtlas activityByDate={activityByDate} />

                <footer className="atlas-legend">
                  <span>Quiet</span>
                  {[0, 1, 2, 3, 4].map((level) => (
                    <i className={`activity-day level-${level}`} key={level} />
                  ))}
                  <span>Busy</span>
                </footer>
              </section>

              <section className="insight-chapter topics-chapter">
                <header className="chapter-heading chapter-heading-stacked">
                  <div>
                    <h2>Where the work went.</h2>
                    <p>
                      {topTopic
                        ? `${topTopic.topic} leads your solved history.`
                        : 'Topic coverage appears after a profile sync.'}
                    </p>
                  </div>
                </header>

                <ol className="topic-editorial-list">
                  {topicChartData.length > 0 ? (
                    topicChartData.map((entry, index) => (
                      <li
                        key={entry.topic}
                        style={{
                          '--topic-color': [
                            '#635bff',
                            '#f05a47',
                            '#168a68',
                            '#d68c22',
                            '#3478d4',
                          ][index % 5],
                          '--topic-width': `${Math.max(
                            (entry.solved / topTopic.solved) * 100,
                            4,
                          )}%`,
                        }}
                      >
                        <div>
                          <span>{entry.topic}</span>
                          <strong>{formatNumber(entry.solved)}</strong>
                        </div>
                        <i>
                          <span />
                        </i>
                      </li>
                    ))
                  ) : (
                    <EmptyState body="Sync a handle first." title="No topic data" />
                  )}
                </ol>
              </section>
            </div>
          </section>
        )}

        {activeView === 'revision' && (
          <section className="screen-view editorial-screen revision-view">
            <ScreenHeader
              body="Return to mistakes while the lesson is still useful."
              title="Revision, deliberately."
            />

            <section className="page-narrative revision-narrative">
              <p>
                <em>{trackedSummary.revision}</em> problems deserve another
                pass.
              </p>
              <div>
                <span>{trackedSummary.lowConfidence} low-confidence notes</span>
                <span>
                  {dashboardSummary?.unsolvedAttemptedCount ?? 0} unsolved
                  Codeforces attempts
                </span>
                <strong>{trackedSummary.solved} tracked problems solved</strong>
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

                  <label className="revision-field">
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

                  <label className="revision-field confidence-field">
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

                  <label className="revision-notes">
                    <span>Revision note</span>
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
                      placeholder="What should you remember next time?"
                      value={problem.notes ?? ''}
                    />
                  </label>

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
