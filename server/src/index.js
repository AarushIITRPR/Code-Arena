import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { connectToDatabase } from './db/connectToDatabase.js'
import { dashboardData } from './data.js'
import trackedProblemsRouter from './routes/trackedProblemsRoutes.js'
import {
  getCodeforcesProblems,
  getCodeforcesProfile,
  getCodeforcesRating,
  getCodeforcesSubmissions,
  getCodeforcesUserSnapshot,
  refreshCodeforcesProblemCache,
  refreshCodeforcesUserSnapshot,
} from './services/codeforcesService.js'

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/dashboard', (request, response) => {
  response.json(dashboardData)
})

app.use('/api/problems', trackedProblemsRouter)

app.get('/api/codeforces/problems', async (request, response) => {
  try {
    const data = await getCodeforcesProblems(request.query)
    response.json(data)
  } catch (error) {
    response.status(502).json({
      error: 'Failed to fetch Codeforces problems',
      message: error.message,
    })
  }
})

app.post('/api/codeforces/problems/refresh', async (request, response) => {
  try {
    const data = await refreshCodeforcesProblemCache()
    response.json(data)
  } catch (error) {
    response.status(502).json({
      error: 'Failed to refresh Codeforces problem cache',
      message: error.message,
    })
  }
})

app.get('/api/codeforces/dashboard/:handle', async (request, response) => {
  try {
    const data = await getCodeforcesUserSnapshot(
      request.params.handle,
      request.query,
    )
    response.json(data)
  } catch (error) {
    response.status(502).json({
      error: 'Failed to fetch Codeforces dashboard snapshot',
      message: error.message,
    })
  }
})

app.post('/api/codeforces/dashboard/:handle/refresh', async (request, response) => {
  try {
    const data = await refreshCodeforcesUserSnapshot(
      request.params.handle,
      request.query,
    )
    response.json(data)
  } catch (error) {
    response.status(502).json({
      error: 'Failed to refresh Codeforces dashboard snapshot',
      message: error.message,
    })
  }
})

app.get('/api/codeforces/profile/:handle', async (request, response) => {
  try {
    const data = await getCodeforcesProfile(request.params.handle)
    response.json(data)
  } catch (error) {
    response.status(502).json({
      error: 'Failed to fetch Codeforces profile',
      message: error.message,
    })
  }
})

app.get('/api/codeforces/submissions/:handle', async (request, response) => {
  try {
    const data = await getCodeforcesSubmissions(
      request.params.handle,
      request.query,
    )
    response.json(data)
  } catch (error) {
    response.status(502).json({
      error: 'Failed to fetch Codeforces submissions',
      message: error.message,
    })
  }
})

app.get('/api/codeforces/rating/:handle', async (request, response) => {
  try {
    const data = await getCodeforcesRating(request.params.handle)
    response.json(data)
  } catch (error) {
    response.status(502).json({
      error: 'Failed to fetch Codeforces rating history',
      message: error.message,
    })
  }
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
