import { formatShortDate } from './lib'

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
