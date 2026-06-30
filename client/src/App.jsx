import { useEffect, useMemo, useState } from 'react'
import './App.css'

const fallbackData = {
  roadmap: [
    { id: 1, stage: 'DSA basics', completed: 8, total: 12 },
    { id: 2, stage: 'Core CS subjects', completed: 5, total: 10 },
    { id: 3, stage: 'Resume and projects', completed: 6, total: 8 },
    { id: 4, stage: 'Mock interviews', completed: 1, total: 5 },
  ],
  practice: [
    {
      id: 1,
      title: 'Two Sum',
      topic: 'Arrays',
      difficulty: 'Easy',
      status: 'Solved',
      confidence: 5,
    },
    {
      id: 2,
      title: 'Longest Substring Without Repeating Characters',
      topic: 'Strings',
      difficulty: 'Medium',
      status: 'Revise',
      confidence: 2,
    },
    {
      id: 3,
      title: 'Binary Tree Level Order Traversal',
      topic: 'Trees',
      difficulty: 'Medium',
      status: 'Revise',
      confidence: 3,
    },
    {
      id: 4,
      title: 'Merge Intervals',
      topic: 'Arrays',
      difficulty: 'Medium',
      status: 'Solved',
      confidence: 4,
    },
  ],
  applications: [
    {
      id: 1,
      company: 'Turing Labs',
      role: 'Frontend Intern',
      deadline: '2026-07-02',
      status: 'Applied',
    },
    {
      id: 2,
      company: 'Northstar Systems',
      role: 'Software Engineer Intern',
      deadline: '2026-07-08',
      status: 'OA',
    },
    {
      id: 3,
      company: 'ByteCraft',
      role: 'Full Stack Intern',
      deadline: '2026-07-15',
      status: 'Wishlist',
    },
  ],
}

function percent(completed, total) {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

function App() {
  const [data, setData] = useState(fallbackData)
  const [apiStatus, setApiStatus] = useState('Loading sample data')

  useEffect(() => {
    fetch('/api/dashboard')
      .then((response) => {
        if (!response.ok) {
          throw new Error('API request failed')
        }
        return response.json()
      })
      .then((dashboardData) => {
        setData(dashboardData)
        setApiStatus('Connected to Express API')
      })
      .catch(() => {
        setApiStatus('Using local sample data')
      })
  }, [])

  const summary = useMemo(() => {
    const completedRoadmap = data.roadmap.reduce(
      (sum, item) => sum + item.completed,
      0,
    )
    const totalRoadmap = data.roadmap.reduce((sum, item) => sum + item.total, 0)
    const solvedProblems = data.practice.filter(
      (problem) => problem.status === 'Solved',
    ).length
    const reviseTopics = data.practice
      .filter((problem) => problem.confidence <= 3)
      .map((problem) => problem.topic)
    const uniqueWeakTopics = [...new Set(reviseTopics)]
    const readinessScore = Math.round(
      percent(completedRoadmap, totalRoadmap) * 0.65 +
        percent(solvedProblems, Math.max(data.practice.length, 1)) * 0.35,
    )

    return {
      readinessScore,
      roadmapProgress: percent(completedRoadmap, totalRoadmap),
      solvedProblems,
      activeApplications: data.applications.length,
      weakTopics: uniqueWeakTopics,
    }
  }, [data])

  const upcomingApplications = [...data.applications].sort(
    (a, b) => new Date(a.deadline) - new Date(b.deadline),
  )

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="PlacementPath navigation">
        <div>
          <p className="eyebrow">PlacementPath</p>
          <h1>Placement readiness dashboard</h1>
        </div>
        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#practice">Practice</a>
          <a href="#companies">Companies</a>
        </nav>
        <p className="status-pill">{apiStatus}</p>
      </aside>

      <section className="content" id="dashboard">
        <div className="topbar">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Know what to focus on next.</h2>
          </div>
          <button type="button">Add progress</button>
        </div>

        <section className="stat-grid" aria-label="Readiness summary">
          <article className="stat-card highlight">
            <span>Readiness</span>
            <strong>{summary.readinessScore}%</strong>
            <p>Based on roadmap progress and solved practice problems.</p>
          </article>
          <article className="stat-card">
            <span>Roadmap</span>
            <strong>{summary.roadmapProgress}%</strong>
            <p>Placement checklist completion.</p>
          </article>
          <article className="stat-card">
            <span>DSA solved</span>
            <strong>{summary.solvedProblems}</strong>
            <p>Problems marked as solved.</p>
          </article>
          <article className="stat-card">
            <span>Applications</span>
            <strong>{summary.activeApplications}</strong>
            <p>Companies currently being tracked.</p>
          </article>
        </section>

        <section className="two-column">
          <div className="panel" id="roadmap">
            <div className="section-heading">
              <p className="eyebrow">Roadmap</p>
              <h2>Preparation stages</h2>
            </div>
            <div className="progress-list">
              {data.roadmap.map((item) => (
                <article className="progress-row" key={item.id}>
                  <div>
                    <strong>{item.stage}</strong>
                    <span>
                      {item.completed} of {item.total} tasks complete
                    </span>
                  </div>
                  <div className="meter" aria-label={`${item.stage} progress`}>
                    <span style={{ width: `${percent(item.completed, item.total)}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="section-heading">
              <p className="eyebrow">Next focus</p>
              <h2>Weak topics</h2>
            </div>
            <div className="topic-list">
              {summary.weakTopics.map((topic) => (
                <span key={topic}>{topic}</span>
              ))}
            </div>
            <p className="panel-note">
              These come from problems where confidence is 3 or lower.
            </p>
          </div>
        </section>

        <section className="two-column">
          <div className="panel" id="practice">
            <div className="section-heading">
              <p className="eyebrow">Practice</p>
              <h2>Recent DSA log</h2>
            </div>
            <div className="table-like">
              {data.practice.map((problem) => (
                <article key={problem.id}>
                  <strong>{problem.title}</strong>
                  <span>{problem.topic}</span>
                  <span>{problem.difficulty}</span>
                  <span>{problem.status}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="panel" id="companies">
            <div className="section-heading">
              <p className="eyebrow">Companies</p>
              <h2>Upcoming deadlines</h2>
            </div>
            <div className="deadline-list">
              {upcomingApplications.map((application) => (
                <article key={application.id}>
                  <div>
                    <strong>{application.company}</strong>
                    <span>{application.role}</span>
                  </div>
                  <div>
                    <time dateTime={application.deadline}>
                      {new Date(application.deadline).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </time>
                    <span>{application.status}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
