import express from 'express'
import mongoose from 'mongoose'
import {
  TrackedProblem,
  TRACKING_CONFIDENCE_SCORES,
  TRACKING_MISTAKE_TYPES,
  TRACKING_QUEUES,
  TRACKING_STATUSES,
} from '../models/TrackedProblem.js'

const router = express.Router()

const PROBLEM_FIELDS = [
  'platform',
  'externalId',
  'title',
  'url',
  'rating',
  'tags',
  'contestId',
  'problemIndex',
]
const TRACKING_FIELDS = [
  'status',
  'queue',
  'notes',
  'mistakeType',
  'confidence',
]

function pickAllowedFields(source, allowedFields) {
  return Object.fromEntries(
    allowedFields
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]]),
  )
}

// Returns tracker data already divided and counted for the Inbox and Revision screens.
function buildTrackedProblemsResponse(problemDocuments) {
  const problems = problemDocuments.map((problem) => {
    const formatted = problem.toJSON()
    return {
      ...formatted,
      topic: formatted.tags[0] ?? 'general',
    }
  })
  const inboxProblems = problems.filter(
    (problem) => problem.status !== 'Revise' && problem.queue !== 'Revision',
  )
  const revisionProblems = problems.filter(
    (problem) => problem.status === 'Revise' || problem.queue === 'Revision',
  )

  return {
    count: problems.length,
    problems,
    inboxProblems,
    revisionProblems,
    summary: {
      inbox: inboxProblems.length,
      revision: revisionProblems.length,
      solved: problems.filter((problem) => problem.status === 'Solved').length,
      lowConfidence: problems.filter(
        (problem) => problem.confidence !== null && problem.confidence <= 2,
      ).length,
    },
    trackedByExternalId: Object.fromEntries(
      problems.map((problem) => [
        problem.externalId,
        {
          id: problem.id,
          status: problem.status,
          queue: problem.queue,
        },
      ]),
    ),
    options: {
      statuses: TRACKING_STATUSES,
      queues: TRACKING_QUEUES,
      mistakeTypes: TRACKING_MISTAKE_TYPES,
      confidenceScores: TRACKING_CONFIDENCE_SCORES,
    },
  }
}

function handleRouteError(error, response) {
  if (error instanceof mongoose.Error.ValidationError) {
    return response.status(400).json({
      error: 'Validation failed',
      message: 'The submitted problem data is invalid.',
    })
  }

  if (error instanceof mongoose.Error.CastError) {
    return response.status(400).json({
      error: 'Invalid id',
      message: 'The tracked problem id is invalid.',
    })
  }

  if (error.code === 11000) {
    return response.status(409).json({
      error: 'Problem already tracked',
      message: 'This problem is already in the practice planner.',
    })
  }

  return response.status(500).json({
    error: 'Server error',
    message: 'The practice tracker could not be updated. Please try again.',
  })
}

router.get('/', async (request, response) => {
  try {
    const problems = await TrackedProblem.find().sort({ updatedAt: -1 })
    response.json(buildTrackedProblemsResponse(problems))
  } catch (error) {
    handleRouteError(error, response)
  }
})

router.post('/', async (request, response) => {
  try {
    const problemFields = pickAllowedFields(request.body, PROBLEM_FIELDS)
    const problem = await TrackedProblem.create({
      ...problemFields,
      status: 'Planned',
      queue: 'Today',
    })
    response.status(201).json(problem)
  } catch (error) {
    handleRouteError(error, response)
  }
})

router.patch('/:id', async (request, response) => {
  try {
    let problem

    if (request.body.action === 'toggleSolved') {
      problem = await TrackedProblem.findById(request.params.id)
      if (problem) {
        problem.status = problem.status === 'Solved' ? 'Attempted' : 'Solved'
        await problem.save()
      }
    } else {
      const updates = pickAllowedFields(request.body, TRACKING_FIELDS)
      if (updates.mistakeType === '') updates.mistakeType = null
      if (updates.confidence === '') updates.confidence = null

      problem = await TrackedProblem.findByIdAndUpdate(
        request.params.id,
        updates,
        { returnDocument: 'after', runValidators: true },
      )
    }

    if (!problem) {
      return response.status(404).json({
        error: 'Problem not found',
        message: 'The tracked problem no longer exists.',
      })
    }

    return response.json(problem)
  } catch (error) {
    return handleRouteError(error, response)
  }
})

router.delete('/:id', async (request, response) => {
  try {
    const problem = await TrackedProblem.findByIdAndDelete(request.params.id)

    if (!problem) {
      return response.status(404).json({
        error: 'Problem not found',
        message: 'The tracked problem no longer exists.',
      })
    }

    return response.status(204).send()
  } catch (error) {
    return handleRouteError(error, response)
  }
})

export default router
