import { Check, ExternalLink } from 'lucide-react'
import { EmptyState, PageHeader } from '../components'
import {
  formatNumber,
  getStatusClass,
} from '../lib'
import { ProfileSyncForm } from './ProfileWorkflow'

export default function InboxWorkflow({
  problems,
  summary,
  dashboard,
  options,
  profile,
  updateProblem,
}) {
  return (
    <section className="screen-view editorial-screen">
      <PageHeader
        action={
          <ProfileSyncForm
            loading={profile.state.loading}
            onChange={profile.setHandleInput}
            onSubmit={profile.sync}
            value={profile.handleInput}
          />
        }
        description="A short, intentional queue of problems worth solving next."
        title="Practice Inbox"
      />
      <section className="page-narrative">
        <p>
          <em>{summary.inbox}</em> problems are waiting for a deliberate attempt.
        </p>
        <div>
          <span>{summary.solved} tracked problems solved</span>
          <span>
            {formatNumber(dashboard?.submissionSummary?.attemptedCount)} attempted
            on Codeforces
          </span>
          <strong>{dashboard?.profile?.rating ?? 'Unrated'} rating</strong>
        </div>
      </section>

      <div className="task-list">
        {problems.map((problem) => (
          <article className="task-row" key={problem.id}>
            <button
              className={`check-button ${getStatusClass(problem.status)}`}
              onClick={() => updateProblem(problem.id, { action: 'toggleSolved' })}
              title="Toggle solved"
              type="button"
            >
              <Check size={13} />
            </button>
            <div className="task-copy">
              <a href={problem.url} rel="noreferrer" target="_blank">
                {problem.title} <ExternalLink size={12} />
              </a>
              <span>
                {problem.externalId} / {problem.rating ?? 'Unrated'} /{' '}
                {problem.topic}
              </span>
            </div>
            <label className="line-field">
              <span>Status</span>
              <select
                onChange={(event) =>
                  updateProblem(problem.id, { status: event.target.value })
                }
                value={problem.status}
              >
                {options.statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="line-field">
              <span>Queue</span>
              <select
                onChange={(event) =>
                  updateProblem(problem.id, { queue: event.target.value })
                }
                value={problem.queue}
              >
                {options.queues.map((queue) => <option key={queue}>{queue}</option>)}
              </select>
            </label>
          </article>
        ))}
        {!problems.length && (
          <EmptyState
            body="Track a problem from Discovery and it will appear here."
            title="Practice inbox is empty"
          />
        )}
      </div>
    </section>
  )
}
