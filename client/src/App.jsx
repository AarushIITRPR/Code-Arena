import { useEffect, useState } from 'react'
import { Sidebar } from './components'
import DiscoveryWorkflow, { useDiscoveryWorkflow } from './workflows/DiscoveryWorkflow'
import InboxWorkflow from './workflows/InboxWorkflow'
import InsightsWorkflow from './workflows/InsightsWorkflow'
import { useProfileWorkflow } from './workflows/ProfileWorkflow'
import RevisionWorkflow from './workflows/RevisionWorkflow'
import { useTrackingWorkflow } from './workflows/TrackingWorkflow'
import { getInitialView } from './lib'
import './styles/base.css'
import './styles/pages.css'
import './styles/insights.css'
import './styles/responsive.css'

export default function App() {
  const [view, setView] = useState(getInitialView)
  const profile = useProfileWorkflow()
  const discovery = useDiscoveryWorkflow()
  const tracking = useTrackingWorkflow(profile.dashboard)

  useEffect(() => {
    const syncHash = () => setView(getInitialView())
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  function navigate(nextView) {
    window.location.hash = nextView
    setView(nextView)
  }

  const errors = [
    profile.state.error,
    discovery.state.error,
    tracking.state.error,
  ].filter(Boolean)

  return (
    <main className="workspace-shell">
      <Sidebar
        counts={{
          inbox: tracking.summary.inbox,
          discovery: discovery.data?.count ?? 0,
          insights: profile.dashboard?.insights?.topicCount ?? 0,
          revision: tracking.summary.revision,
        }}
        dashboard={profile.dashboard}
        handle={profile.activeHandle}
        onNavigate={navigate}
        view={view}
      />
      <section className="main-feed">
        {errors.length > 0 && (
          <div className="error-stack">
            {errors.map((error) => <span key={error}>{error}</span>)}
          </div>
        )}

        {view === 'inbox' && (
          <InboxWorkflow
            dashboard={profile.dashboard}
            options={tracking.options}
            problems={tracking.inboxProblems}
            profile={profile}
            summary={tracking.summary}
            updateProblem={tracking.updateProblem}
          />
        )}

        {view === 'discovery' && (
          <DiscoveryWorkflow
            attemptStatusDefault={tracking.attemptStatusDefault}
            attemptStatusByProblem={tracking.attemptStatusByProblem}
            discovery={discovery}
            savingId={tracking.savingId}
            trackProblem={tracking.trackProblem}
            trackedByExternalId={tracking.trackedByExternalId}
          />
        )}

        {view === 'insights' && (
          <InsightsWorkflow
            dashboard={profile.dashboard}
            handle={profile.activeHandle}
            handleInput={profile.handleInput}
            loading={profile.state.loading}
            onSync={profile.sync}
            setHandleInput={profile.setHandleInput}
          />
        )}

        {view === 'revision' && (
          <RevisionWorkflow
            dashboardSummary={profile.dashboard?.submissionSummary}
            deleteProblem={tracking.deleteProblem}
            options={tracking.options}
            problems={tracking.revisionProblems}
            savingId={tracking.savingId}
            summary={tracking.summary}
            updateProblem={tracking.updateProblem}
          />
        )}
      </section>
    </main>
  )
}
