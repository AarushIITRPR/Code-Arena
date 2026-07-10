import { useMemo } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import {
  buildActivityMonths,
  formatNumber,
  formatShortDate,
  getActivityLevel,
} from './lib'

export function Sidebar({ view, onNavigate, counts, dashboard, handle }) {
  const links = [
    ['inbox', 'Practice Inbox', counts.inbox],
    ['discovery', 'Problem Discovery', counts.discovery],
    ['insights', 'Profile Insights', counts.insights],
    ['revision', 'Revision Log', counts.revision],
  ]

  return (
    <aside className="nav-rail" aria-label="CodeArena navigation">
      <div className="workspace-brand">
        <strong>CodeArena</strong>
        <em>Practice, deliberately.</em>
      </div>
      <nav className="workspace-nav">
        {links.map(([key, label, count]) => (
          <button
            className={view === key ? 'active' : ''}
            key={key}
            onClick={() => onNavigate(key)}
            type="button"
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </nav>
      <div className="rail-footer">
        <div className="account-dot">
          {dashboard?.profile?.avatar ? (
            <img alt="" src={dashboard.profile.avatar} />
          ) : (
            handle.slice(0, 1).toUpperCase()
          )}
        </div>
        <div>
          <strong>{handle}</strong>
          <span>
            {dashboard?.profile?.rating ?? 'unrated'} rating /{' '}
            {formatShortDate(dashboard?.syncedAt)}
          </span>
        </div>
      </div>
    </aside>
  )
}

export function PageHeader({ title, description, action }) {
  return (
    <header className="screen-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

export function SyncForm({ value, loading, onChange, onSubmit }) {
  return (
    <form className="sync-command" onSubmit={onSubmit}>
      <input
        aria-label="Codeforces handle"
        onChange={(event) => onChange(event.target.value)}
        placeholder="tourist"
        value={value}
      />
      <button className="plain-action" disabled={loading}>
        {loading ? <Loader2 className="spin" size={15} /> : <RefreshCcw size={15} />}
        Sync
      </button>
    </form>
  )
}

export function EmptyState({ title, body }) {
  return (
    <div className="empty-line">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

export function CodeforcesIcon() {
  return (
    <span className="codeforces-icon" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

export function ActivityAtlas({ activityByDate }) {
  const months = useMemo(
    () => buildActivityMonths(activityByDate),
    [activityByDate],
  )
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="activity-atlas" aria-label="Twelve month submission heatmap">
      {months.map((month, monthIndex) => (
        <article className="activity-month" key={month.key}>
          <header>
            <span>
              {month.label}
              {(monthIndex === 0 || month.label === 'Jan') && <small>{month.year}</small>}
            </span>
            <strong>{formatNumber(month.submissions)}</strong>
          </header>
          <div className="activity-week-key" aria-hidden="true">
            {weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="activity-month-grid">
            {month.cells.map((day, index) => {
              if (!day) return <i className="activity-day empty" key={index} />
              const label = `${day.key}: ${day.submissions} submissions, ${day.accepted} accepted`
              return (
                <i
                  aria-label={label}
                  className={`activity-day level-${getActivityLevel(day.submissions)}${day.future ? ' future' : ''}`}
                  key={day.key}
                  title={label}
                />
              )
            })}
          </div>
        </article>
      ))}
    </div>
  )
}
