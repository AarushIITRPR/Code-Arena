import { Loader2, RefreshCcw } from 'lucide-react'
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
import { EmptyState } from '../components'
import { formatNumber, formatShortDate, getRatingAccent } from '../lib'

export default function InsightsWorkflow({
  dashboard,
  handle,
  handleInput,
  setHandleInput,
  loading,
  onSync,
}) {
  const summary = dashboard?.submissionSummary
  const insights = dashboard?.insights
  const topicData = insights?.topicData ?? []
  const ratingData = insights?.ratingData ?? []
  const activityMetrics = insights?.activityMetrics ?? {
    activeDays: 0,
    currentStreak: 0,
  }
  const activityMonths = insights?.activityMonths ?? []
  const activityLegendLevels = insights?.activityLegendLevels ?? []
  const solveRate = insights?.solveRate ?? 0
  const topTopic = insights?.topTopic
  const topRating = insights?.topRating
  const colors = ['#635bff', '#f05a47', '#168a68', '#d68c22', '#3478d4']

  return (
    <section className="screen-view insights-view">
      <header className="profile-header">
        <div className="profile-person">
          <div className="profile-avatar">
            {dashboard?.profile?.avatar ? (
              <img alt="" src={dashboard.profile.avatar} />
            ) : (
              <span>{handle.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <p>Codeforces profile <span>updated {formatShortDate(dashboard?.syncedAt)}</span></p>
            <h1>{dashboard?.profile?.handle ?? handle}</h1>
            <em>{dashboard?.profile?.rank ?? 'Unrated'}</em>
          </div>
        </div>
        <form className="profile-sync" onSubmit={onSync}>
          <span>@</span>
          <input
            aria-label="Codeforces handle"
            onChange={(event) => setHandleInput(event.target.value)}
            value={handleInput}
          />
          <button aria-label="Sync profile" disabled={loading} title="Sync profile">
            {loading ? <Loader2 className="spin" size={17} /> : <RefreshCcw size={17} />}
          </button>
        </form>
      </header>

      <section className="profile-narrative">
        <p>
          <em>{formatNumber(summary?.solvedCount)}</em> unique problems solved,
          with a <em>{solveRate}%</em> solve rate.
        </p>
        <div className="rating-readout">
          <p>
            <strong style={{ color: getRatingAccent(dashboard?.profile?.rating) }}>
              {dashboard?.profile?.rating ?? 'Unrated'}
            </strong>{' '}now
          </p>
          <p><strong>{dashboard?.profile?.maxRating ?? '-'}</strong> personal best</p>
          <span>
            {formatNumber(summary?.totalSubmissions)} submissions across{' '}
            {activityMetrics.activeDays} active days
          </span>
        </div>
      </section>

      <section className="insight-chapter difficulty-chapter">
        <header className="chapter-heading">
          <div>
            <h2>Difficulty, mapped.</h2>
            <p>Every bar is a Codeforces rating; every height is a unique accepted problem.</p>
          </div>
          {topRating && (
            <p className="chapter-note">
              Your deepest shelf is{' '}
              <strong style={{ color: getRatingAccent(topRating.rating) }}>{topRating.rating}</strong>,
              with {formatNumber(topRating.solved)} solved.
            </p>
          )}
        </header>
        <div className="difficulty-spectrum">
          {ratingData.length ? (
            <ResponsiveContainer height={350} width="100%">
              <BarChart data={ratingData} margin={{ bottom: 4, left: -12, right: 8, top: 26 }}>
                <CartesianGrid stroke="#e9e5ff" vertical={false} />
                <XAxis dataKey="rating" minTickGap={24} tick={{ fill: '#5f5878', fontSize: 10 }} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tick={{ fill: '#837c9c', fontSize: 10 }} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,91,255,.05)' }} />
                <Bar animationDuration={900} dataKey="solved" maxBarSize={34} radius={[3, 3, 0, 0]}>
                  {ratingData.map((item) => <Cell fill={getRatingAccent(item.rating)} key={item.rating} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState body="Rated solves appear after a profile sync." title="No rating data" />
          )}
        </div>
      </section>

      <div className="insights-asymmetry">
        <section className="insight-chapter activity-chapter">
          <header className="chapter-heading stacked">
            <div>
              <h2>A year in practice.</h2>
              <p>Twelve monthly calendars, built from the latest 1,000 submissions.</p>
            </div>
            <p className="activity-summary">
              <strong>{activityMetrics.activeDays}</strong> active days
              <span>{activityMetrics.currentStreak ? `${activityMetrics.currentStreak}-day current streak` : 'No active streak today'}</span>
            </p>
          </header>
          <ActivityAtlas months={activityMonths} />
          <footer className="atlas-legend">
            <span>Quiet</span>
            {activityLegendLevels.map((level) => <i className={`activity-day level-${level}`} key={level} />)}
            <span>Busy</span>
          </footer>
        </section>

        <section className="insight-chapter topics-chapter">
          <header className="chapter-heading stacked">
            <div>
              <h2>Where the work went.</h2>
              <p>{topTopic ? `${topTopic.topic} leads your solved history.` : 'Topic coverage appears after a sync.'}</p>
            </div>
          </header>
          <ol className="topic-list">
            {topicData.length ? topicData.map((item, index) => (
              <li key={item.topic} style={{ '--topic-color': colors[index % colors.length] }}>
                <div><span>{item.topic}</span><strong>{formatNumber(item.solved)}</strong></div>
                <i><span style={{ width: `${item.barPercentage}%` }} /></i>
              </li>
            )) : <EmptyState body="Sync a handle first." title="No topic data" />}
          </ol>
        </section>
      </div>
    </section>
  )
}

function ActivityAtlas({ months }) {
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
                  className={`activity-day level-${day.level}${day.future ? ' future' : ''}`}
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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>{formatNumber(payload[0].value)} solved</span>
    </div>
  )
}
