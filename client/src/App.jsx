import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components'
import InboxPage from './pages/InboxPage'
import DiscoveryPage from './pages/DiscoveryPage'
import InsightsPage from './pages/InsightsPage'
import RevisionPage from './pages/RevisionPage'
import {
  apiRequest,
  DEFAULT_HANDLE,
  getActivityMetrics,
  getInitialView,
  PAGE_SIZE,
} from './lib'
import './styles/base.css'
import './styles/pages.css'
import './styles/insights.css'
import './styles/responsive.css'

const initialFilters = {
  search: '',
  tags: [],
  minRating: '800',
  maxRating: '1600',
  page: '1',
}

export default function App() {
  const [view, setView] = useState(getInitialView)
  const [handleInput, setHandleInput] = useState(DEFAULT_HANDLE)
  const [activeHandle, setActiveHandle] = useState(DEFAULT_HANDLE)
  const [dashboard, setDashboard] = useState(null)
  const [dashboardState, setDashboardState] = useState({ loading: true, error: '' })
  const [filters, setFilters] = useState(initialFilters)
  const [problemData, setProblemData] = useState(null)
  const [problemState, setProblemState] = useState({ loading: true, error: '' })
  const [trackedProblems, setTrackedProblems] = useState([])
  const [trackedState, setTrackedState] = useState({ loading: true, error: '' })
  const [savingId, setSavingId] = useState('')

  async function loadDashboard(handle, refresh = false) {
    const cleanHandle = handle.trim()
    if (!cleanHandle) {
      setDashboardState({ loading: false, error: 'Enter a Codeforces handle.' })
      return
    }

    setDashboardState({ loading: true, error: '' })
    setActiveHandle(cleanHandle)
    localStorage.setItem('codearena:handle', cleanHandle)
    try {
      const suffix = refresh ? '/refresh' : ''
      const data = await apiRequest(
        `/api/codeforces/dashboard/${encodeURIComponent(cleanHandle)}${suffix}?count=1000`,
        { method: refresh ? 'POST' : 'GET' },
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
        value.filter(Boolean).forEach((item) => params.append(key, item))
      } else if (String(value).trim()) {
        params.set(key, String(value).trim())
      }
    })
    params.set('limit', String(PAGE_SIZE))

    try {
      setProblemData(await apiRequest(`/api/codeforces/problems?${params}`))
      setProblemState({ loading: false, error: '' })
    } catch (error) {
      setProblemState({ loading: false, error: error.message })
    }
  }

  async function refreshProblems() {
    setProblemState({ loading: true, error: '' })
    try {
      await apiRequest('/api/codeforces/problems/refresh', { method: 'POST' })
      const nextFilters = { ...filters, page: '1' }
      setFilters(nextFilters)
      await loadProblems(nextFilters)
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
        body: JSON.stringify({ ...problem, status: 'Planned', queue: 'Today' }),
      })
      await loadTrackedProblems()
    } catch (error) {
      setTrackedState({ loading: false, error: error.message })
    } finally {
      setSavingId('')
    }
  }

  async function updateProblem(problemId, updates) {
    setSavingId(problemId)
    setTrackedProblems((current) => current.map((problem) =>
      problem.id === problemId ? { ...problem, ...updates } : problem,
    ))
    try {
      const updated = await apiRequest(`/api/problems/${problemId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      setTrackedProblems((current) => current.map((problem) =>
        problem.id === problemId ? updated : problem,
      ))
    } catch (error) {
      setTrackedState({ loading: false, error: error.message })
      await loadTrackedProblems()
    } finally {
      setSavingId('')
    }
  }

  async function deleteProblem(problemId) {
    setSavingId(problemId)
    try {
      await apiRequest(`/api/problems/${problemId}`, { method: 'DELETE' })
      setTrackedProblems((current) => current.filter((problem) => problem.id !== problemId))
    } catch (error) {
      setTrackedState({ loading: false, error: error.message })
    } finally {
      setSavingId('')
    }
  }

  useEffect(() => {
    loadDashboard(DEFAULT_HANDLE)
    loadProblems(initialFilters)
    loadTrackedProblems()
  }, [])

  useEffect(() => {
    const syncHash = () => setView(getInitialView())
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const summary = dashboard?.submissionSummary
  const inboxProblems = useMemo(() => trackedProblems.filter((problem) =>
    problem.status !== 'Revise' && problem.queue !== 'Revision',
  ), [trackedProblems])
  const revisionProblems = useMemo(() => trackedProblems.filter((problem) =>
    problem.status === 'Revise' || problem.queue === 'Revision',
  ), [trackedProblems])
  const trackedSummary = useMemo(() => ({
    inbox: inboxProblems.length,
    revision: revisionProblems.length,
    solved: trackedProblems.filter((problem) => problem.status === 'Solved').length,
    lowConfidence: trackedProblems.filter((problem) =>
      problem.confidence != null && problem.confidence <= 2,
    ).length,
  }), [inboxProblems, revisionProblems, trackedProblems])

  const trackedById = useMemo(() => new Map(
    trackedProblems.map((problem) => [problem.externalId, problem]),
  ), [trackedProblems])

  const attemptsById = useMemo(() => {
    const attempts = new Map()
    summary?.unsolvedAttemptedProblems?.forEach((problem) => {
      if (problem.externalId) attempts.set(problem.externalId, 'Unsolved')
    })
    summary?.solvedProblems?.forEach((problem) => {
      if (problem.externalId) attempts.set(problem.externalId, 'Solved')
    })
    dashboard?.recentSubmissions?.forEach((submission) => {
      const id = submission.problem?.externalId
      if (!id) return
      if (submission.verdict === 'OK') attempts.set(id, 'Solved')
      else if (!attempts.has(id)) attempts.set(id, 'Unsolved')
    })
    return attempts
  }, [dashboard?.recentSubmissions, summary])

  const topicData = useMemo(() => Object.entries(summary?.solvedByTag ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([topic, solved]) => ({ topic, solved })), [summary])
  const ratingData = useMemo(() => Object.entries(summary?.solvedByRating ?? {})
    .filter(([rating]) => rating !== 'unrated')
    .map(([rating, solved]) => ({ rating: Number(rating), solved }))
    .sort((a, b) => a.rating - b.rating), [summary])
  const activityByDate = useMemo(() => {
    if (Object.keys(summary?.activityByDate ?? {}).length) return summary.activityByDate
    return (dashboard?.recentSubmissions ?? []).reduce((days, submission) => {
      const date = submission.submittedAt?.slice(0, 10)
      if (!date) return days
      const day = days[date] ?? { submissions: 0, accepted: 0 }
      day.submissions += 1
      if (submission.verdict === 'OK') day.accepted += 1
      days[date] = day
      return days
    }, {})
  }, [dashboard?.recentSubmissions, summary])
  const activityMetrics = useMemo(() => getActivityMetrics(activityByDate), [activityByDate])

  function navigate(nextView) {
    window.location.hash = nextView
    setView(nextView)
  }

  function sync(event) {
    event.preventDefault()
    loadDashboard(handleInput, true)
  }

  function search(event) {
    event.preventDefault()
    const nextFilters = { ...filters, page: '1' }
    setFilters(nextFilters)
    loadProblems(nextFilters)
  }

  function changePage(page) {
    const nextFilters = { ...filters, page: String(page) }
    setFilters(nextFilters)
    loadProblems(nextFilters)
  }

  function toggleTag(tag) {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter((item) => item !== tag)
      : [...filters.tags, tag]
    setFilters({ ...filters, tags, page: '1' })
  }

  const errors = [dashboardState.error, problemState.error, trackedState.error].filter(Boolean)
  const syncProps = {
    value: handleInput,
    loading: dashboardState.loading,
    onChange: setHandleInput,
    onSubmit: sync,
  }

  return (
    <main className="workspace-shell">
      <Sidebar
        counts={{
          inbox: trackedSummary.inbox,
          discovery: problemData?.count ?? 0,
          insights: topicData.length,
          revision: trackedSummary.revision,
        }}
        dashboard={dashboard}
        handle={activeHandle}
        onNavigate={navigate}
        view={view}
      />
      <section className="main-feed">
        {errors.length > 0 && <div className="error-stack">{errors.map((error) => <span key={error}>{error}</span>)}</div>}
        {view === 'inbox' && (
          <InboxPage
            dashboard={dashboard}
            problems={inboxProblems}
            summary={trackedSummary}
            sync={syncProps}
            updateProblem={updateProblem}
          />
        )}
        {view === 'discovery' && (
          <DiscoveryPage
            attemptsById={attemptsById}
            data={problemData}
            filters={filters}
            onPage={changePage}
            onRefresh={refreshProblems}
            onSearch={search}
            onToggleTag={toggleTag}
            onTrack={trackProblem}
            savingId={savingId}
            setFilters={setFilters}
            state={problemState}
            trackedById={trackedById}
          />
        )}
        {view === 'insights' && (
          <InsightsPage
            activityByDate={activityByDate}
            activityMetrics={activityMetrics}
            dashboard={dashboard}
            handle={activeHandle}
            handleInput={handleInput}
            loading={dashboardState.loading}
            onSync={sync}
            ratingData={ratingData}
            setHandleInput={setHandleInput}
            summary={summary}
            topicData={topicData}
          />
        )}
        {view === 'revision' && (
          <RevisionPage
            dashboardSummary={summary}
            deleteProblem={deleteProblem}
            problems={revisionProblems}
            savingId={savingId}
            setProblems={setTrackedProblems}
            summary={trackedSummary}
            updateProblem={updateProblem}
          />
        )}
      </section>
    </main>
  )
}
