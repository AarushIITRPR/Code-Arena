export const DEFAULT_HANDLE =
  localStorage.getItem('codearena:handle') || 'tourist'

export const VIEWS = ['inbox', 'discovery', 'insights', 'revision']
export const STATUS_OPTIONS = ['Planned', 'Attempted', 'Solved', 'Revise']
export const QUEUE_OPTIONS = ['Today', 'Revision', 'Weak Topic', 'Later']
export const MISTAKE_OPTIONS = [
  '',
  'Concept gap',
  'Implementation bug',
  'Edge case missed',
  'TLE / optimization',
  'Could not derive approach',
]
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

export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (response.status === 204) return null
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Request failed')
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

export function getProblemTopic(problem) {
  return problem.tags?.[0] ?? 'general'
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

export function getActivityLevel(count) {
  if (!count) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 7) return 3
  return 4
}

function dateKey(date) {
  return date.toISOString().slice(0, 10)
}

export function buildActivityMonths(activityByDate, monthCount = 12) {
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )

  return Array.from({ length: monthCount }, (_, index) => {
    const first = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() - monthCount + index + 1,
        1,
      ),
    )
    const days = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate()
    const cells = Array.from({ length: 42 }, (_, cell) => {
      const day = cell - first.getUTCDay() + 1
      if (day < 1 || day > days) return null
      const date = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day),
      )
      const activity = activityByDate[dateKey(date)] ?? {}
      return {
        key: dateKey(date),
        date,
        future: date > today,
        submissions: activity.submissions ?? 0,
        accepted: activity.accepted ?? 0,
      }
    })

    return {
      key: dateKey(first),
      label: new Intl.DateTimeFormat('en', {
        month: 'short',
        timeZone: 'UTC',
      }).format(first),
      year: first.getUTCFullYear(),
      submissions: cells.reduce((sum, day) => sum + (day?.submissions ?? 0), 0),
      cells,
    }
  })
}

export function getActivityMetrics(activityByDate) {
  const activeDates = new Set(
    Object.entries(activityByDate)
      .filter(([, value]) => value.submissions > 0)
      .map(([date]) => date),
  )
  const now = new Date()
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  if (!activeDates.has(dateKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1)

  let currentStreak = 0
  while (activeDates.has(dateKey(cursor))) {
    currentStreak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return { activeDays: activeDates.size, currentStreak }
}
