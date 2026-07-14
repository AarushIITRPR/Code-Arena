import { CodeforcesProblemCache } from '../models/CodeforcesProblemCache.js'
import { CodeforcesUserSnapshot } from '../models/CodeforcesUserSnapshot.js'

const CODEFORCES_API_BASE = 'https://codeforces.com/api'
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200
const DEFAULT_SUBMISSION_COUNT = 500
const MAX_SUBMISSION_COUNT = 1000

// Shared by the problem and dashboard workflows.
async function callCodeforces(methodName, params = {}) {
  const url = new URL(`${CODEFORCES_API_BASE}/${methodName}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Codeforces request failed with ${response.status}`)
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

  return {
    search: typeof filters.search === 'string' ? filters.search.trim() : '',
    tags: normalizeTagFilters(filters.tags ?? filters.tag),
    minRating,
    maxRating,
    limit: Math.min(Math.max(requestedLimit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    page: Math.max(requestedPage ?? 1, 1),
  }
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
  return String(handle).trim().toLowerCase()
}

async function fetchLiveCodeforcesProfile(handle) {
  const users = await callCodeforces('user.info', { handles: handle })
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

function formatUserSnapshot(snapshot) {
  return {
    source: 'Codeforces',
    handle: snapshot.profile.handle,
    syncedAt: dateToIsoDate(snapshot.syncedAt),
    profile: snapshot.profile,
    submissionSummary: snapshot.submissionSummary,
    recentSubmissions: snapshot.recentSubmissions ?? [],
  }
}

export async function refreshCodeforcesUserSnapshot(handle, options = {}) {
  const normalizedHandle = normalizeHandle(handle)
  const profile = await fetchLiveCodeforcesProfile(handle)
  const submissions = await fetchLiveCodeforcesSubmissions(handle, options)
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

  return refreshCodeforcesUserSnapshot(handle, options)
}
