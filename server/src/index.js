import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { connectToDatabase } from './db/connectToDatabase.js'
import trackedProblemsRouter from './routes/trackedProblemsRoutes.js'
import {
  getCodeforcesProblems,
  getCodeforcesUserSnapshot,
  refreshCodeforcesProblemCache,
  refreshCodeforcesUserSnapshot,
} from './services/codeforcesService.js'

const app = express()
const port = process.env.PORT || 4000

function sendApiError(response, error, fallbackMessage, defaultStatus = 502) {
  response.status(error.statusCode ?? defaultStatus).json({
    error: fallbackMessage,
    message: error.message || fallbackMessage,
  })
}

async function sendDashboard(request, response, refresh = false) {
  try {
    const handle = request.params.handle ?? request.query.handle
    const data = refresh
      ? await refreshCodeforcesUserSnapshot(handle, request.query)
      : await getCodeforcesUserSnapshot(handle, request.query)
    response.json(data)
  } catch (error) {
    sendApiError(
      response,
      error,
      refresh
        ? 'Failed to refresh Codeforces dashboard snapshot'
        : 'Failed to fetch Codeforces dashboard snapshot',
    )
  }
}

app.use(cors())
app.use(express.json())

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' })
})

app.use('/api/problems', trackedProblemsRouter)

app.get('/api/codeforces/problems', async (request, response) => {
  try {
    const data = await getCodeforcesProblems(request.query)
    response.json(data)
  } catch (error) {
    sendApiError(response, error, 'Failed to fetch Codeforces problems')
  }
})

app.post('/api/codeforces/problems/refresh', async (request, response) => {
  try {
    const data = await refreshCodeforcesProblemCache()
    response.json(data)
  } catch (error) {
    sendApiError(
      response,
      error,
      'Failed to refresh Codeforces problem cache',
    )
  }
})

// Query-based aliases let the backend validate even an empty handle.
app.get('/api/codeforces/dashboard', async (request, response) => {
  await sendDashboard(request, response)
})

app.post('/api/codeforces/dashboard/refresh', async (request, response) => {
  await sendDashboard(request, response, true)
})

// Existing path-based routes remain available for API compatibility.
app.get('/api/codeforces/dashboard/:handle', async (request, response) => {
  await sendDashboard(request, response)
})

app.post('/api/codeforces/dashboard/:handle/refresh', async (request, response) => {
  await sendDashboard(request, response, true)
})

app.use((error, request, response, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).json({
      error: 'Invalid JSON',
      message: 'The request body must contain valid JSON.',
    })
  }

  return next(error)
})

try {
  await connectToDatabase()

  app.listen(port, () => {
    console.log(`CodeArena API running at http://localhost:${port}`)
  })
} catch (error) {
  console.error('Failed to start CodeArena API')
  console.error(error.message)
  process.exit(1)
}
