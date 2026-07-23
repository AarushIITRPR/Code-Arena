export const DEFAULT_HANDLE =
  localStorage.getItem('codearena:handle') || 'tourist'

export const VIEWS = ['inbox', 'discovery', 'insights', 'revision']
export const PAGE_SIZE = 39
export const CODEFORCES_TAGS = [
  'implementation',
  'math',
  'greedy',
  'dp',
  'data structures',
  'brute force',
  'constructive algorithms',
  'graphs',
  'sortings',
  'binary search',
  'dfs and similar',
  'trees',
  'strings',
  'number theory',
  'combinatorics',
  'bitmasks',
  'two pointers',
  'dsu',
  'geometry',
  'shortest paths',
  'probabilities',
  'divide and conquer',
  'hashing',
  'games',
  'flows',
  'matrices',
]

// Sends a request to our Express API and turns non-success responses into JavaScript errors.
export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (response.status === 204) return null
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.message || 'The request could not be completed.')
  }
  return payload
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value ?? 0)
}

export function formatShortDate(value) {
  if (!value) return 'Not synced'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function getInitialView() {
  const view = window.location.hash.replace('#', '')
  return VIEWS.includes(view) ? view : 'inbox'
}

export function getStatusClass(status = '') {
  return status.toLowerCase().replaceAll(' ', '-')
}

export function getRatingAccent(rating) {
  if (rating == null || rating < 1200) return '#808080'
  if (rating < 1400) return '#008000'
  if (rating < 1600) return '#03a89e'
  if (rating < 1900) return '#0000ff'
  if (rating < 2100) return '#aa00aa'
  if (rating < 2400) return '#ff8c00'
  if (rating < 3000) return '#ff0000'
  return '#aa0000'
}

export function formatTagSummary(tags) {
  if (!tags.length) return 'Choose tags'
  if (tags.length <= 2) return tags.join(', ')
  return `${tags.slice(0, 2).join(', ')} +${tags.length - 2}`
}

export function getVisiblePages(currentPage, totalPages) {
  const pages = new Set([1, totalPages])
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page)
  }
  return [...pages].sort((a, b) => a - b)
}
