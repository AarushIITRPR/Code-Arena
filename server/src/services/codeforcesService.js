import { CodeforcesProblemCache } from '../models/CodeforcesProblemCache.js'
import { CodeforcesUserSnapshot } from '../models/CodeforcesUserSnapshot.js'

const CODEFORCES_API_BASE = 'https://codeforces.com/api'
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200
const DEFAULT_SUBMISSION_COUNT = 500
const MAX_SUBMISSION_COUNT = 1000

function createServiceError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

// Shared by the problem and dashboard workflows.
async function callCodeforces(methodName, params = {}) {
  const url = new URL(`${CODEFORCES_API_BASE}/${methodName}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  let response
  try {
    response = await fetch(url)
  } catch {
    throw createServiceError(
      'Codeforces is currently unavailable. Please try again.',
      502,
    )
  }

  if (!response.ok) {
    throw createServiceError(
      'Codeforces is currently unavailable. Please try again.',
      502,
    )
  }

  const payload = await response.json()

  if (payload.status !== 'OK') {
    throw new Error(payload.comment || 'Codeforces returned a non-OK response')
  }

  return payload.result
}

function normalizeCodeforcesProblem(problem) {
  return {
    platform: 'Codeforces',
    externalId: `${problem.contestId}-${problem.index}`,
    title: problem.name,
    url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
    rating: problem.rating ?? null,
    tags: problem.tags ?? [],
    contestId: problem.contestId,
    problemIndex: problem.index,
  }
}

function dateToIsoDate(date) {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString()
}

function parseInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

// Problem discovery and MongoDB problem-cache workflow.
function normalizeTagFilters(value) {
  const values = Array.isArray(value) ? value : [value]

  return [
    ...new Set(
      values
        .flatMap((tag) => String(tag ?? '').split(','))
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
}

function normalizeFilters(filters) {
  const minRating = parseInteger(filters.minRating)
  const maxRating = parseInteger(filters.maxRating)
  const requestedLimit = parseInteger(filters.limit)
  const requestedPage = parseInteger(filters.page)

  const normalizedFilters = {
    search: typeof filters.search === 'string' ? filters.search.trim() : '',
    tags: normalizeTagFilters(filters.tags ?? filters.tag),
    minRating,
    maxRating,
    limit: Math.min(Math.max(requestedLimit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    page: Math.max(requestedPage ?? 1, 1),
  }

  if (
    normalizedFilters.minRating !== null
    && normalizedFilters.maxRating !== null
    && normalizedFilters.minRating > normalizedFilters.maxRating
  ) {
    throw createServiceError(
      'Minimum rating cannot be greater than maximum rating.',
      400,
    )
  }

  return normalizedFilters
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildProblemCacheQuery(filters) {
  const query = {}

  if (filters.search) {
    const escapedSearch = escapeRegExp(filters.search)

    query.$or = [
      { title: { $regex: escapedSearch, $options: 'i' } },
      { externalId: { $regex: escapedSearch, $options: 'i' } },
    ]
  }

  if (filters.tags.length === 1) {
    query.tags = filters.tags[0]
  }

  if (filters.tags.length > 1) {
    query.tags = { $all: filters.tags }
  }

  if (filters.minRating !== null || filters.maxRating !== null) {
    query.rating = { $ne: null }

    if (filters.minRating !== null) {
      query.rating.$gte = filters.minRating
    }

    if (filters.maxRating !== null) {
      query.rating.$lte = filters.maxRating
    }
  }

  return query
}

function formatCachedProblem(problem) {
  return {
    platform: problem.platform,
    externalId: problem.externalId,
    title: problem.title,
    url: problem.url,
    rating: problem.rating ?? null,
    tags: problem.tags ?? [],
    contestId: problem.contestId,
    problemIndex: problem.problemIndex,
  }
}

export async function refreshCodeforcesProblemCache() {
  const result = await callCodeforces('problemset.problems')
  const syncedAt = new Date()
  const problems = result.problems
    .filter((problem) => problem.contestId && problem.index)
    .filter((problem) => problem.type === 'PROGRAMMING')
    .map((problem) => ({
      ...normalizeCodeforcesProblem(problem),
      syncedAt,
    }))

  if (problems.length > 0) {
    await CodeforcesProblemCache.bulkWrite(
      problems.map((problem) => ({
        updateOne: {
          filter: { externalId: problem.externalId },
          update: { $set: problem },
          upsert: true,
        },
      })),
      { ordered: false },
    )
  }

  return {
    source: 'Codeforces',
    syncedAt: syncedAt.toISOString(),
    problemCount: problems.length,
  }
}

export async function getCodeforcesProblems(filters = {}) {
  const normalizedFilters = normalizeFilters(filters)
  const cachedCount = await CodeforcesProblemCache.estimatedDocumentCount()

  if (cachedCount === 0) {
    await refreshCodeforcesProblemCache()
  }

  const query = buildProblemCacheQuery(normalizedFilters)
  const skip = (normalizedFilters.page - 1) * normalizedFilters.limit
  const [cachedMetadata, totalMatched, cachedProblems] = await Promise.all([
    CodeforcesProblemCache.findOne().sort({ syncedAt: -1 }).lean(),
    CodeforcesProblemCache.countDocuments(query),
    CodeforcesProblemCache.find(query)
      .sort({ contestId: -1, problemIndex: -1 })
      .skip(skip)
      .limit(normalizedFilters.limit)
      .lean(),
  ])
  const totalPages = Math.max(Math.ceil(totalMatched / normalizedFilters.limit), 1)

  return {
    source: 'Codeforces',
    cachedAt: cachedMetadata
      ? dateToIsoDate(cachedMetadata.syncedAt)
      : null,
    count: cachedProblems.length,
    totalMatched,
    page: normalizedFilters.page,
    totalPages,
    hasPreviousPage: normalizedFilters.page > 1,
    hasNextPage: normalizedFilters.page < totalPages,
    filters: normalizedFilters,
    problems: cachedProblems.map(formatCachedProblem),
  }
}

// Codeforces profile, submission analytics, and user-snapshot workflow.
function normalizeHandle(handle) {
  const normalizedHandle = String(handle ?? '').trim().toLowerCase()

  if (!normalizedHandle) {
    throw createServiceError('Enter a Codeforces handle.', 400)
  }

  return normalizedHandle
}

async function fetchLiveCodeforcesProfile(handle) {
  let users
  try {
    users = await callCodeforces('user.info', { handles: handle })
  } catch (error) {
    if (error.message.toLowerCase().includes('not found')) {
      throw createServiceError(
        `Codeforces handle "${handle}" was not found.`,
        404,
      )
    }
    throw error
  }
  const user = users[0]

  return {
    handle: user.handle,
    rank: user.rank ?? null,
    rating: user.rating ?? null,
    maxRating: user.maxRating ?? null,
    avatar: user.avatar ?? null,
  }
}

function normalizeSubmission(submission) {
  return {
    submittedAt: new Date(
      submission.creationTimeSeconds * 1000,
    ).toISOString(),
    verdict: submission.verdict ?? 'TESTING',
    problem: normalizeCodeforcesProblem(submission.problem),
  }
}

function summarizeSubmissions(submissions) {
  const acceptedProblems = new Map()
  const attemptedProblems = new Map()
  const activityByDate = {}
  const solvedByRating = {}
  const solvedByTag = {}

  submissions.forEach((submission) => {
    const key = submission.problem.externalId
    const submissionDate = submission.submittedAt.slice(0, 10)
    const dailyActivity = activityByDate[submissionDate] ?? {
      submissions: 0,
      accepted: 0,
    }

    dailyActivity.submissions += 1

    if (submission.verdict === 'OK') {
      dailyActivity.accepted += 1
    }

    activityByDate[submissionDate] = dailyActivity
    attemptedProblems.set(key, submission.problem)

    if (submission.verdict !== 'OK' || acceptedProblems.has(key)) {
      return
    }

    acceptedProblems.set(key, submission.problem)

    const ratingKey =
      submission.problem.rating === null
        ? 'unrated'
        : String(submission.problem.rating)

    solvedByRating[ratingKey] = (solvedByRating[ratingKey] ?? 0) + 1

    submission.problem.tags.forEach((tag) => {
      solvedByTag[tag] = (solvedByTag[tag] ?? 0) + 1
    })
  })

  const unsolvedAttemptedProblems = [...attemptedProblems.entries()]
    .filter(([key]) => !acceptedProblems.has(key))
    .map(([, problem]) => problem)

  return {
    totalSubmissions: submissions.length,
    solvedCount: acceptedProblems.size,
    attemptedCount: attemptedProblems.size,
    unsolvedAttemptedCount: unsolvedAttemptedProblems.length,
    solvedProblems: [...acceptedProblems.values()],
    unsolvedAttemptedProblems,
    activityByDate,
    solvedByRating,
    solvedByTag,
  }
}

async function fetchLiveCodeforcesSubmissions(handle, options = {}) {
  const requestedCount = parseInteger(options.count)
  const count = Math.min(
    Math.max(requestedCount ?? DEFAULT_SUBMISSION_COUNT, 1),
    MAX_SUBMISSION_COUNT,
  )
  const submissions = await callCodeforces('user.status', {
    handle,
    from: 1,
    count,
  })

  const normalizedSubmissions = submissions
    .filter(
      (submission) => submission.problem?.contestId && submission.problem?.index,
    )
    .map(normalizeSubmission)

  return {
    ...summarizeSubmissions(normalizedSubmissions),
    recentSubmissions: normalizedSubmissions.slice(0, 25),
  }
}

function buildAttemptStatusLookup(submissionSummary) {
  const statuses = {}

  submissionSummary.unsolvedAttemptedProblems?.forEach((problem) => {
    statuses[problem.externalId] = 'Unsolved'
  })
  submissionSummary.solvedProblems?.forEach((problem) => {
    statuses[problem.externalId] = 'Solved'
  })

  return statuses
}

function buildActivityByDate(submissionSummary, recentSubmissions) {
  if (Object.keys(submissionSummary.activityByDate ?? {}).length > 0) {
    return submissionSummary.activityByDate
  }

  return recentSubmissions.reduce((days, submission) => {
    const date = submission.submittedAt?.slice(0, 10)
    if (!date) return days

    const day = days[date] ?? { submissions: 0, accepted: 0 }
    day.submissions += 1
    if (submission.verdict === 'OK') day.accepted += 1
    days[date] = day
    return days
  }, {})
}

function dateKey(date) {
  return date.toISOString().slice(0, 10)
}

function getActivityLevel(count) {
  if (!count) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 7) return 3
  return 4
}

function buildActivityMonths(activityByDate, monthCount = 12) {
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
      const submissions = activity.submissions ?? 0

      return {
        key: dateKey(date),
        future: date > today,
        submissions,
        accepted: activity.accepted ?? 0,
        level: getActivityLevel(submissions),
      }
    })

    return {
      key: dateKey(first),
      label: new Intl.DateTimeFormat('en', {
        month: 'short',
        timeZone: 'UTC',
      }).format(first),
      year: first.getUTCFullYear(),
      submissions: cells.reduce(
        (sum, day) => sum + (day?.submissions ?? 0),
        0,
      ),
      cells,
    }
  })
}

function getActivityMetrics(activityByDate) {
  const activeDates = new Set(
    Object.entries(activityByDate)
      .filter(([, value]) => value.submissions > 0)
      .map(([date]) => date),
  )
  const now = new Date()
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )

  if (!activeDates.has(dateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  let currentStreak = 0
  while (activeDates.has(dateKey(cursor))) {
    currentStreak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return {
    activeDays: activeDates.size,
    currentStreak,
  }
}

// Shapes submission analytics so React only has to render the returned values.
function buildDashboardInsights(submissionSummary, recentSubmissions) {
  const topicData = Object.entries(submissionSummary.solvedByTag ?? {})
    .sort(([, first], [, second]) => second - first)
    .slice(0, 10)
    .map(([topic, solved]) => ({ topic, solved }))
  const topTopic = topicData[0] ?? null
  const topics = topicData.map((topic) => ({
    ...topic,
    barPercentage: topTopic
      ? Math.max((topic.solved / topTopic.solved) * 100, 4)
      : 0,
  }))
  const ratingData = Object.entries(submissionSummary.solvedByRating ?? {})
    .filter(([rating]) => rating !== 'unrated')
    .map(([rating, solved]) => ({ rating: Number(rating), solved }))
    .sort((first, second) => first.rating - second.rating)
  const topRating = ratingData.reduce(
    (best, item) => item.solved > (best?.solved ?? -1) ? item : best,
    null,
  )
  const activityByDate = buildActivityByDate(
    submissionSummary,
    recentSubmissions,
  )

  return {
    solveRate: submissionSummary.attemptedCount
      ? Math.round(
        (submissionSummary.solvedCount / submissionSummary.attemptedCount) * 100,
      )
      : 0,
    ratingData,
    topicData: topics,
    topRating,
    topTopic,
    activityMetrics: getActivityMetrics(activityByDate),
    activityMonths: buildActivityMonths(activityByDate),
    activityLegendLevels: [0, 1, 2, 3, 4],
    topicCount: topics.length,
  }
}

function formatUserSnapshot(snapshot) {
  const submissionSummary = snapshot.submissionSummary
  const recentSubmissions = snapshot.recentSubmissions ?? []

  return {
    source: 'Codeforces',
    handle: snapshot.profile.handle,
    syncedAt: dateToIsoDate(snapshot.syncedAt),
    profile: snapshot.profile,
    submissionSummary,
    recentSubmissions,
    attemptStatusByProblem: buildAttemptStatusLookup(submissionSummary),
    attemptStatusDefault: 'Unattempted',
    insights: buildDashboardInsights(submissionSummary, recentSubmissions),
  }
}

export async function refreshCodeforcesUserSnapshot(handle, options = {}) {
  const normalizedHandle = normalizeHandle(handle)
  const profile = await fetchLiveCodeforcesProfile(normalizedHandle)
  const submissions = await fetchLiveCodeforcesSubmissions(
    normalizedHandle,
    options,
  )
  const syncedAt = new Date()
  const { recentSubmissions, ...submissionSummary } = submissions

  const snapshot = await CodeforcesUserSnapshot.findOneAndUpdate(
    { handle: normalizedHandle },
    {
      $set: {
        handle: normalizedHandle,
        profile,
        submissionSummary,
        recentSubmissions,
        syncedAt,
      },
    },
    { returnDocument: 'after', upsert: true },
  ).lean()

  return formatUserSnapshot(snapshot)
}

export async function getCodeforcesUserSnapshot(handle, options = {}) {
  const normalizedHandle = normalizeHandle(handle)
  const snapshot = await CodeforcesUserSnapshot.findOne({
    handle: normalizedHandle,
  }).lean()

  if (snapshot) {
    return formatUserSnapshot(snapshot)
  }

  return refreshCodeforcesUserSnapshot(normalizedHandle, options)
}
