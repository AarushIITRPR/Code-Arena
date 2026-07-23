import { useEffect, useState } from 'react'
import { DatabaseZap, Loader2, Search } from 'lucide-react'
import { CodeforcesIcon, EmptyState, PageHeader } from '../components'
import {
  apiRequest,
  CODEFORCES_TAGS,
  formatNumber,
  formatTagSummary,
  getRatingAccent,
  getStatusClass,
  getVisiblePages,
  PAGE_SIZE,
} from '../lib'
import { TrackProblemButton } from './TrackingWorkflow'

/* oxlint-disable react/only-export-components */

const initialFilters = {
  search: '',
  tags: [],
  minRating: '800',
  maxRating: '1600',
  page: '1',
}

export function useDiscoveryWorkflow() {
  const [filters, setFilters] = useState(initialFilters)
  const [data, setData] = useState(null)
  const [state, setState] = useState({ loading: true, error: '' })

  // Converts the active filters into query parameters and fetches one results page.
  async function loadProblems(nextFilters = filters) {
    setState({ loading: true, error: '' })
    const params = new URLSearchParams()

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, item))
      } else {
        params.set(key, value)
      }
    })
    params.set('limit', String(PAGE_SIZE))

    try {
      setData(await apiRequest(`/api/codeforces/problems?${params}`))
      setState({ loading: false, error: '' })
    } catch (error) {
      setState({ loading: false, error: error.message })
    }
  }

  // Rebuilds the backend problem cache before repeating the search from page one.
  async function refreshProblems() {
    setState({ loading: true, error: '' })
    try {
      await apiRequest('/api/codeforces/problems/refresh', { method: 'POST' })
      const nextFilters = { ...filters, page: '1' }
      setFilters(nextFilters)
      await loadProblems(nextFilters)
    } catch (error) {
      setState({ loading: false, error: error.message })
    }
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

  useEffect(() => {
    loadProblems(initialFilters)
  }, [])

  return {
    changePage,
    data,
    filters,
    refreshProblems,
    search,
    setFilters,
    state,
    toggleTag,
  }
}

export default function DiscoveryWorkflow({
  attemptStatusDefault,
  attemptStatusByProblem,
  discovery,
  savingId,
  trackProblem,
  trackedByExternalId,
}) {
  const {
    changePage,
    data,
    filters,
    refreshProblems,
    search,
    setFilters,
    state,
    toggleTag,
  } = discovery

  return (
    <section className="screen-view editorial-screen">
      <PageHeader
        action={
          <button className="plain-action" disabled={state.loading} onClick={refreshProblems} type="button">
            <DatabaseZap size={15} /> Refresh cache
          </button>
        }
        description="Search Codeforces by topic, rating, or title, then keep only what deserves your attention."
        title="Find your next problem."
      />

      <form className="search-line" onSubmit={search}>
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
                      onChange={() => toggleTag(tag)}
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
          const tracked = trackedByExternalId[problem.externalId]
          const attempt = attemptStatusByProblem[problem.externalId]
            ?? attemptStatusDefault

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
                <TrackProblemButton
                  onTrack={trackProblem}
                  problem={problem}
                  savingId={savingId}
                  tracked={tracked}
                />
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
            <button disabled={state.loading || !data.hasPreviousPage} onClick={() => changePage(data.page - 1)}>Previous</button>
            {getVisiblePages(data.page, data.totalPages).map((page, index, pages) => (
              <span key={page}>
                {index > 0 && page - pages[index - 1] > 1 && <i>...</i>}
                <button className={page === data.page ? 'active' : ''} disabled={state.loading} onClick={() => changePage(page)}>{page}</button>
              </span>
            ))}
            <button disabled={state.loading || !data.hasNextPage} onClick={() => changePage(data.page + 1)}>Next</button>
          </nav>
        </div>
      )}
    </section>
  )
}
