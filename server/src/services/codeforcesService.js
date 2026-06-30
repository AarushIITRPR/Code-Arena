import { CodeforcesProblemCache } from '../models/CodeforcesProblemCache.js'
import { CodeforcesUserSnapshot } from '../models/CodeforcesUserSnapshot.js'

const CODEFORCES_API_BASE = 'https://codeforces.com/api'
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200
const DEFAULT_SUBMISSION_COUNT = 500
const MAX_SUBMISSION_COUNT = 1000

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

function createProblemUrl(contestId, problemIndex) {
  return `https://codeforces.com/problemset/problem/${contestId}/${encodeURIComponent(problemIndex)}`
}

function normalizeCodeforcesProblem(problem) {
  return {
    platform: 'Codeforces',
    externalId: `${problem.contestId}-${problem.index}`,
    title: problem.name,
    url: createProblemUrl(problem.contestId, problem.index),
    rating: problem.rating ?? null,
    tags: problem.tags ?? [],
    contestId: problem.contestId,
    contestDivision: null,
    problemIndex: problem.index,
  }
}

function toIsoDate(seconds) {
  return new Date(seconds * 1000).toISOString()
}

function dateToIsoDate(date) {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString()
}

function normalizeHandle(handle) {
  return String(handle).trim().toLowerCase()
}

function normalizeUserProfile(user) {
  return {
    handle: user.handle,
    rank: user.rank ?? null,
    rating: user.rating ?? null,
    maxRank: user.maxRank ?? null,
    maxRating: user.maxRating ?? null,
    contribution: user.contribution ?? 0,
    avatar: user.avatar ?? null,
    titlePhoto: user.titlePhoto ?? null,
    lastOnlineAt: user.lastOnlineTimeSeconds
      ? toIsoDate(user.lastOnlineTimeSeconds)
      : null,
    registeredAt: user.registrationTimeSeconds
      ? toIsoDate(user.registrationTimeSeconds)
      : null,
    friendOfCount: user.friendOfCount ?? 0,
  }
}

function normalizeSubmission(submission) {
  return {
    id: submission.id,
    submittedAt: toIsoDate(submission.creationTimeSeconds),
    verdict: submission.verdict ?? 'TESTING',
    programmingLanguage: submission.programmingLanguage,
    passedTestCount: submission.passedTestCount ?? 0,
    timeConsumedMillis: submission.timeConsumedMillis ?? 0,
    memoryConsumedBytes: submission.memoryConsumedBytes ?? 0,
    problem: normalizeCodeforcesProblem(submission.problem),
  }
}

function parseInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeFilters(filters) {
  const minRating = parseInteger(filters.minRating)
  const maxRating = parseInteger(filters.maxRating)
  const requestedLimit = parseInteger(filters.limit)

  return {
    search: typeof filters.search === 'string' ? filters.search.trim() : '',
    tag: typeof filters.tag === 'string' ? filters.tag.trim().toLowerCase() : '',
    minRating,
    maxRating,
    limit: Math.min(Math.max(requestedLimit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
  }
}

function normalizeSubmissionOptions(options) {
  const requestedCount = parseInteger(options.count)

  return {
    count: Math.min(
      Math.max(requestedCount ?? DEFAULT_SUBMISSION_COUNT, 1),
      MAX_SUBMISSION_COUNT,
    ),
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

  if (filters.tag) {
    query.tags = filters.tag
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
    contestDivision: problem.contestDivision ?? null,
    problemIndex: problem.problemIndex,
  }
}

function getProblemKey(problem) {
  return `${problem.contestId}-${problem.problemIndex}`
}

function summarizeSubmissions(submissions) {
  const acceptedProblems = new Map()
  const attemptedProblems = new Map()
  const solvedByRating = {}
  const solvedByTag = {}

  submissions.forEach((submission) => {
    const key = getProblemKey(submission.problem)
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
    unsolvedAttemptedProblems,
    solvedByRating,
    solvedByTag,
  }
}

function formatUserSnapshot(snapshot, fromCache = true) {
  const syncedAt = dateToIsoDate(snapshot.syncedAt)

  return {
    source: 'Codeforces',
    handle: snapshot.profile.handle,
    cachedHandle: snapshot.handle,
    syncedAt,
    fromCache,
    fetchedSubmissionCount: snapshot.fetchedSubmissionCount,
    profile: snapshot.profile,
    submissionSummary: snapshot.submissionSummary,
    recentSubmissions: snapshot.recentSubmissions ?? [],
    ratingHistory: snapshot.ratingHistory ?? [],
  }
}

async function ensureProblemCache() {
  const cachedCount = await CodeforcesProblemCache.estimatedDocumentCount()

  if (cachedCount === 0) {
    await refreshCodeforcesProblemCache()
  }
}

async function fetchLiveCodeforcesProfile(handle) {
  const users = await callCodeforces('user.info', { handles: handle })
  return normalizeUserProfile(users[0])
}

async function fetchLiveCodeforcesSubmissions(handle, options = {}) {
  const normalizedOptions = normalizeSubmissionOptions(options)
  const submissions = await callCodeforces('user.status', {
    handle,
    from: 1,
    count: normalizedOptions.count,
  })

  const normalizedSubmissions = submissions
    .filter(
      (submission) => submission.problem?.contestId && submission.problem?.index,
    )
    .map(normalizeSubmission)

  return {
    source: 'Codeforces',
    handle,
    requestedCount: normalizedOptions.count,
    ...summarizeSubmissions(normalizedSubmissions),
    recentSubmissions: normalizedSubmissions.slice(0, 25),
  }
}

async function fetchLiveCodeforcesRating(handle) {
  const ratingChanges = await callCodeforces('user.rating', { handle })

  return {
    source: 'Codeforces',
    handle,
    count: ratingChanges.length,
    ratingHistory: ratingChanges.map((change) => ({
      contestId: change.contestId,
      contestName: change.contestName,
      rank: change.rank,
      ratedAt: toIsoDate(change.ratingUpdateTimeSeconds),
      oldRating: change.oldRating,
      newRating: change.newRating,
      delta: change.newRating - change.oldRating,
    })),
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
  await ensureProblemCache()

  const query = buildProblemCacheQuery(normalizedFilters)
  const [cachedMetadata, totalMatched, cachedProblems] = await Promise.all([
    CodeforcesProblemCache.findOne().sort({ syncedAt: -1 }).lean(),
    CodeforcesProblemCache.countDocuments(query),
    CodeforcesProblemCache.find(query)
      .sort({ rating: 1, externalId: 1 })
      .limit(normalizedFilters.limit)
      .lean(),
  ])

  return {
    source: 'Codeforces',
    cachedAt: cachedMetadata
      ? dateToIsoDate(cachedMetadata.syncedAt)
      : null,
    count: cachedProblems.length,
    totalMatched,
    filters: normalizedFilters,
    problems: cachedProblems.map(formatCachedProblem),
  }
}

export async function refreshCodeforcesUserSnapshot(handle, options = {}) {
  const normalizedHandle = normalizeHandle(handle)
  const profile = await fetchLiveCodeforcesProfile(handle)
  const submissions = await fetchLiveCodeforcesSubmissions(handle, options)
  const rating = await fetchLiveCodeforcesRating(handle)
  const syncedAt = new Date()
  const { recentSubmissions, requestedCount, source, ...submissionSummary } =
    submissions

  const snapshot = await CodeforcesUserSnapshot.findOneAndUpdate(
    { handle: normalizedHandle },
    {
      $set: {
        handle: normalizedHandle,
        profile,
        submissionSummary,
        recentSubmissions,
        ratingHistory: rating.ratingHistory,
        fetchedSubmissionCount: requestedCount,
        syncedAt,
      },
    },
    { returnDocument: 'after', upsert: true },
  ).lean()

  return formatUserSnapshot(snapshot, false)
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

export async function getCodeforcesProfile(handle) {
  const snapshot = await getCodeforcesUserSnapshot(handle)
  return {
    ...snapshot.profile,
    syncedAt: snapshot.syncedAt,
    fromCache: snapshot.fromCache,
  }
}

export async function getCodeforcesSubmissions(handle, options = {}) {
  const snapshot = await getCodeforcesUserSnapshot(handle, options)

  return {
    source: 'Codeforces',
    handle: snapshot.handle,
    requestedCount: snapshot.fetchedSubmissionCount,
    syncedAt: snapshot.syncedAt,
    fromCache: snapshot.fromCache,
    ...snapshot.submissionSummary,
    recentSubmissions: snapshot.recentSubmissions,
  }
}

export async function getCodeforcesRating(handle) {
  const snapshot = await getCodeforcesUserSnapshot(handle)

  return {
    source: 'Codeforces',
    handle: snapshot.handle,
    syncedAt: snapshot.syncedAt,
    fromCache: snapshot.fromCache,
    count: snapshot.ratingHistory.length,
    ratingHistory: snapshot.ratingHistory,
  }
}
