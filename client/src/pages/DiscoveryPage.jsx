import { Check, DatabaseZap, Loader2, Plus, Search } from 'lucide-react'
import { CodeforcesIcon, EmptyState, PageHeader } from '../components'
import {
  CODEFORCES_TAGS,
  formatNumber,
  formatTagSummary,
  getRatingAccent,
  getStatusClass,
  getVisiblePages,
} from '../lib'

export default function DiscoveryPage({
  filters,
  setFilters,
  data,
  state,
  trackedById,
  attemptsById,
  savingId,
  onSearch,
  onRefresh,
  onPage,
  onTrack,
  onToggleTag,
}) {
  return (
    <section className="screen-view editorial-screen">
      <PageHeader
        action={
          <button className="plain-action" disabled={state.loading} onClick={onRefresh} type="button">
            <DatabaseZap size={15} /> Refresh cache
          </button>
        }
        description="Search Codeforces by topic, rating, or title, then keep only what deserves your attention."
        title="Find your next problem."
      />

      <form className="search-line" onSubmit={onSearch}>
        <label className="search-query">
          <span>Search</span>
          <input
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: '1' })}
            placeholder="watermelon, 4-A, graphs"
            value={filters.search}
          />
        </label>
        <div className="tag-filter">
          <span>Tags</span>
          <details className="tag-multiselect">
            <summary>{formatTagSummary(filters.tags)}</summary>
            <div className="tag-menu">
              <header>
                <strong>Codeforces tags</strong>
                <button
                  disabled={!filters.tags.length}
                  onClick={() => setFilters({ ...filters, tags: [], page: '1' })}
                  type="button"
                >
                  Clear
                </button>
              </header>
              <div>
                {CODEFORCES_TAGS.map((tag) => (
                  <label key={tag}>
                    <input
                      checked={filters.tags.includes(tag)}
                      onChange={() => onToggleTag(tag)}
                      type="checkbox"
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
        {['minRating', 'maxRating'].map((key) => (
          <label key={key}>
            <span>{key === 'minRating' ? 'Min' : 'Max'}</span>
            <input
              inputMode="numeric"
              onChange={(event) => setFilters({ ...filters, [key]: event.target.value, page: '1' })}
              value={filters[key]}
            />
          </label>
        ))}
        <button className="solid-button" disabled={state.loading}>
          {state.loading ? <Loader2 className="spin" size={15} /> : <Search size={15} />}
          Search
        </button>
      </form>

      <div className="problem-results-title">
        <h2>Matching problems</h2>
        {data && <span>{data.count} shown / {formatNumber(data.totalMatched)} matched</span>}
      </div>

      <div className="problem-index">
        {state.loading && <EmptyState body="Loading matching problems." title="Searching" />}
        {!state.loading && (data?.problems ?? []).map((problem) => {
          const tracked = trackedById.get(problem.externalId)
          const attempt = attemptsById.get(problem.externalId) ?? 'Unattempted'
          return (
            <article
              className="problem-entry"
              key={problem.externalId}
              style={{ '--problem-accent': getRatingAccent(problem.rating) }}
            >
              <header>
                <p><span>{problem.externalId}</span><strong>{problem.rating ?? 'Unrated'}</strong></p>
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
              <p className="problem-tags" title={problem.tags.join(', ')}>
                {problem.tags.length ? problem.tags.slice(0, 2).join(' / ') : 'untagged'}
                {problem.tags.length > 2 && <span> +{problem.tags.length - 2}</span>}
              </p>
              <footer>
                <div className="problem-state">
                  <span className={getStatusClass(attempt)}>{attempt}</span>
                  {tracked && <em>{tracked.status}</em>}
                </div>
                <button
                  className="plain-action"
                  disabled={Boolean(tracked) || savingId === problem.externalId}
                  onClick={() => onTrack(problem)}
                  type="button"
                >
                  {savingId === problem.externalId ? <Loader2 className="spin" size={14} /> : tracked ? <Check size={14} /> : <Plus size={14} />}
                  {tracked ? 'Tracked' : 'Add'}
                </button>
              </footer>
            </article>
          )
        })}
        {!state.loading && data?.problems?.length === 0 && (
          <EmptyState body="Try a wider rating range or another tag." title="No matching problems" />
        )}
      </div>

      {data && (
        <div className="pagination-bar">
          <span>Showing {data.count} of {formatNumber(data.totalMatched)} matches</span>
          <nav aria-label="Problem pages">
            <button disabled={state.loading || !data.hasPreviousPage} onClick={() => onPage(data.page - 1)}>Previous</button>
            {getVisiblePages(data.page, data.totalPages).map((page, index, pages) => (
              <span key={page}>
                {index > 0 && page - pages[index - 1] > 1 && <i>...</i>}
                <button className={page === data.page ? 'active' : ''} disabled={state.loading} onClick={() => onPage(page)}>{page}</button>
              </span>
            ))}
            <button disabled={state.loading || !data.hasNextPage} onClick={() => onPage(data.page + 1)}>Next</button>
          </nav>
        </div>
      )}
    </section>
  )
}
