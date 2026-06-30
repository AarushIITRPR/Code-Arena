import express from 'express'
import mongoose from 'mongoose'
import { TrackedProblem } from '../models/TrackedProblem.js'

const router = express.Router()

const TRACKING_FIELDS = [
  'status',
  'queue',
  'notes',
  'mistakeType',
  'confidence',
]

function buildProblemFilters(query) {
  const filters = {}

  if (query.status) {
    filters.status = query.status
  }

  if (query.queue) {
    filters.queue = query.queue
  }

  if (query.tag) {
    filters.tags = query.tag
  }

  if (query.search) {
    filters.title = { $regex: query.search, $options: 'i' }
  }

  return filters
}

function pickAllowedFields(source, allowedFields) {
  return Object.fromEntries(
    allowedFields
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]]),
  )
}

function handleRouteError(error, response) {
  if (error instanceof mongoose.Error.ValidationError) {
    return response.status(400).json({
      error: 'Validation failed',
      message: error.message,
    })
  }

  if (error instanceof mongoose.Error.CastError) {
    return response.status(400).json({
      error: 'Invalid id',
      message: error.message,
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
    message: error.message,
  })
}

router.get('/', async (request, response) => {
  try {
    const filters = buildProblemFilters(request.query)
    const problems = await TrackedProblem.find(filters).sort({ updatedAt: -1 })

    response.json({
      count: problems.length,
      problems,
    })
  } catch (error) {
    handleRouteError(error, response)
  }
})

router.post('/', async (request, response) => {
  try {
    const problem = await TrackedProblem.create(request.body)
    response.status(201).json(problem)
  } catch (error) {
    handleRouteError(error, response)
  }
})

router.patch('/:id', async (request, response) => {
  try {
    const updates = pickAllowedFields(request.body, TRACKING_FIELDS)

    const problem = await TrackedProblem.findByIdAndUpdate(
      request.params.id,
      updates,
      { returnDocument: 'after', runValidators: true },
    )

    if (!problem) {
      return response.status(404).json({
        error: 'Problem not found',
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
      })
    }

    return response.status(204).send()
  } catch (error) {
    return handleRouteError(error, response)
  }
})

export default router
