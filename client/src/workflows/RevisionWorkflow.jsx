import { ExternalLink, Trash2 } from 'lucide-react'
import { EmptyState, PageHeader } from '../components'
import { getStatusClass } from '../lib'

export default function RevisionWorkflow({
  problems,
  summary,
  dashboardSummary,
  options,
  savingId,
  updateProblem,
  deleteProblem,
}) {
  return (
    <section className="screen-view editorial-screen">
      <PageHeader
        description="Return to mistakes while the lesson is still useful."
        title="Revision, deliberately."
      />
      <section className="page-narrative">
        <p><em>{summary.revision}</em> problems deserve another pass.</p>
        <div>
          <span>{summary.lowConfidence} low-confidence notes</span>
          <span>{dashboardSummary?.unsolvedAttemptedCount ?? 0} unsolved Codeforces attempts</span>
          <strong>{summary.solved} tracked problems solved</strong>
        </div>
      </section>

      <div className="revision-list">
        {problems.map((problem) => (
          <article className="revision-row" key={problem.id}>
            <div className="revision-main">
              <span className={`status-token ${getStatusClass(problem.status)}`}>{problem.status}</span>
              <div>
                <a href={problem.url} rel="noreferrer" target="_blank">
                  {problem.title} <ExternalLink size={12} />
                </a>
                <span>{problem.externalId} / {problem.rating ?? 'Unrated'} / {problem.topic}</span>
              </div>
            </div>
            <label className="line-field">
              <span>Mistake</span>
              <select
                onChange={(event) => updateProblem(problem.id, { mistakeType: event.target.value })}
                value={problem.mistakeType ?? ''}
              >
                <option value="">-</option>
                {options.mistakeTypes.map((mistake) => <option key={mistake}>{mistake}</option>)}
              </select>
            </label>
            <label className="line-field">
              <span>Confidence</span>
              <select
                onChange={(event) => updateProblem(problem.id, { confidence: event.target.value })}
                value={problem.confidence ?? ''}
              >
                <option value="">-</option>
                {options.confidenceScores.map((score) => <option key={score}>{score}</option>)}
              </select>
            </label>
            <label className="revision-notes">
              <span>Revision note</span>
              <textarea
                aria-label={`Notes for ${problem.title}`}
                defaultValue={problem.notes ?? ''}
                onBlur={(event) => updateProblem(problem.id, { notes: event.target.value })}
                placeholder="What should you remember next time?"
              />
            </label>
            <button
              className="delete-button"
              disabled={savingId === problem.id}
              onClick={() => deleteProblem(problem.id)}
              title="Remove from tracker"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </article>
        ))}
        {!problems.length && (
          <EmptyState
            body="Mark a tracked problem as Revise or move it to Revision."
            title="Revision log is clear"
          />
        )}
      </div>
    </section>
  )
}
