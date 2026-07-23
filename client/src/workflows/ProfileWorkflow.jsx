import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { apiRequest, DEFAULT_HANDLE } from '../lib'

/* oxlint-disable react/only-export-components */

export function useProfileWorkflow() {
  const [handleInput, setHandleInput] = useState(DEFAULT_HANDLE)
  const [activeHandle, setActiveHandle] = useState(DEFAULT_HANDLE)
  const [dashboard, setDashboard] = useState(null)
  const [state, setState] = useState({ loading: true, error: '' })

  // Sends the raw handle to the backend, which validates and normalizes it.
  async function loadDashboard(handle, refresh = false) {
    setState({ loading: true, error: '' })

    try {
      const suffix = refresh ? '/refresh' : ''
      const params = new URLSearchParams({ handle, count: '1000' })
      const data = await apiRequest(
        `/api/codeforces/dashboard${suffix}?${params}`,
        { method: refresh ? 'POST' : 'GET' },
      )
      setActiveHandle(data.handle)
      setHandleInput(data.handle)
      localStorage.setItem('codearena:handle', data.handle)
      setDashboard(data)
      setState({ loading: false, error: '' })
    } catch (error) {
      setState({ loading: false, error: error.message })
    }
  }

  useEffect(() => {
    loadDashboard(DEFAULT_HANDLE)
  }, [])

  function sync(event) {
    event.preventDefault()
    loadDashboard(handleInput, true)
  }

  return {
    activeHandle,
    dashboard,
    handleInput,
    setHandleInput,
    state,
    sync,
  }
}

export function ProfileSyncForm({ value, loading, onChange, onSubmit }) {
  return (
    <form className="sync-command" onSubmit={onSubmit}>
      <input
        aria-label="Codeforces handle"
        onChange={(event) => onChange(event.target.value)}
        placeholder="tourist"
        value={value}
      />
      <button className="plain-action" disabled={loading}>
        {loading ? <Loader2 className="spin" size={15} /> : <RefreshCcw size={15} />}
        Sync
      </button>
    </form>
  )
}
