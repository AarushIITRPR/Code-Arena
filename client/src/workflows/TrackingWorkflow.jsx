import { useEffect, useState } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { apiRequest } from '../lib'

/* oxlint-disable react/only-export-components */

const EMPTY_TRACKER = {
  problems: [],
  inboxProblems: [],
  revisionProblems: [],
  summary: { inbox: 0, revision: 0, solved: 0, lowConfidence: 0 },
  trackedByExternalId: {},
  options: {
    statuses: [],
    queues: [],
    mistakeTypes: [],
    confidenceScores: [],
  },
}

export function useTrackingWorkflow(dashboard) {
  const [data, setData] = useState(EMPTY_TRACKER)
  const [state, setState] = useState({ loading: true, error: '' })
  const [savingId, setSavingId] = useState('')

  async function loadProblems() {
    setState({ loading: true, error: '' })
    try {
      setData(await apiRequest('/api/problems'))
      setState({ loading: false, error: '' })
    } catch (error) {
      setState({ loading: false, error: error.message })
    }
  }

  async function trackProblem(problem) {
    setSavingId(problem.externalId)
    try {
      await apiRequest('/api/problems', {
        method: 'POST',
        body: JSON.stringify(problem),
      })
      await loadProblems()
    } catch (error) {
      setState({ loading: false, error: error.message })
    } finally {
      setSavingId('')
    }
  }

  async function updateProblem(problemId, updates) {
    setSavingId(problemId)
    try {
      await apiRequest(`/api/problems/${problemId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      await loadProblems()
    } catch (error) {
      setState({ loading: false, error: error.message })
    } finally {
      setSavingId('')
    }
  }

  async function deleteProblem(problemId) {
    setSavingId(problemId)
    try {
      await apiRequest(`/api/problems/${problemId}`, { method: 'DELETE' })
      await loadProblems()
    } catch (error) {
      setState({ loading: false, error: error.message })
    } finally {
      setSavingId('')
    }
  }

  useEffect(() => {
    loadProblems()
  }, [])

  return {
    ...data,
    attemptStatusByProblem: dashboard?.attemptStatusByProblem ?? {},
    attemptStatusDefault: dashboard?.attemptStatusDefault ?? '...',
    deleteProblem,
    savingId,
    state,
    trackProblem,
    updateProblem,
  }
}

export function TrackProblemButton({ problem, tracked, savingId, onTrack }) {
  return (
    <button
      className="plain-action"
      disabled={Boolean(tracked) || savingId === problem.externalId}
      onClick={() => onTrack(problem)}
      type="button"
    >
      {savingId === problem.externalId ? (
        <Loader2 className="spin" size={14} />
      ) : tracked ? (
        <Check size={14} />
      ) : (
        <Plus size={14} />
      )}
      {tracked ? 'Tracked' : 'Add'}
    </button>
  )
}
