import { useState } from 'react'
import { apiFetch } from '../api.js'
import { useAuth } from '../App.jsx'

export default function Dashboard() {
  const { auth, logout } = useAuth()
  const [flagKey, setFlagKey] = useState('')
  const [result, setResult] = useState(null) // null | { state: 'enabled'|'disabled'|'notfound'|'error', message: string }
  const [loading, setLoading] = useState(false)

  const checkFlag = async (e) => {
    e.preventDefault()
    const key = flagKey.trim()
    if (!key) { setResult({ state: 'error', message: 'Please enter a flag key.' }); return }
    setLoading(true); setResult(null)
    try {
      const data = await apiFetch(`/api/flags/check/${encodeURIComponent(key)}`, { token: auth.token })
      setResult({ state: data.enabled ? 'enabled' : 'disabled', key: data.key, enabled: data.enabled })
    } catch (err) {
      if (err.status === 401) { logout(); return }
      if (err.status === 404) {
        setResult({ state: 'notfound', message: `No flag with key "${key}" found in your organization.` })
      } else {
        setResult({ state: 'error', message: err.message || 'Request failed.' })
      }
    } finally { setLoading(false) }
  }

  const resultConfig = {
    enabled:  { icon: '✅', label: 'Enabled',   color: 'var(--success)', bg: 'var(--success-subtle)', border: 'rgba(16,185,129,.4)' },
    disabled: { icon: '❌', label: 'Disabled',  color: 'var(--danger)',  bg: 'var(--danger-subtle)',  border: 'rgba(239,68,68,.4)' },
    notfound: { icon: '🔍', label: 'Not Found', color: 'var(--warning)', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.4)' },
    error:    { icon: '⚠️', label: 'Error',     color: 'var(--danger)',  bg: 'var(--danger-subtle)',  border: 'rgba(239,68,68,.4)' },
  }

  return (
    <>
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">🚩</div>
          <span className="logo-name">FlagFlow</span>
          <span className="role-badge" style={{ background: 'rgba(16,185,129,.15)', color: 'var(--success)', borderColor: 'var(--success)' }}>
            End User
          </span>
        </div>
        <div className="header-right">
          <span className="user-email">{auth.user.email}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ marginBottom: '.25rem' }}>Feature Flag Checker</h1>
          <p>Enter a feature flag key to check if it's enabled for your organization.</p>
        </div>

        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '1rem' }}>🔍 Check a Flag</h2>
          <form onSubmit={checkFlag} noValidate>
            <div className="form-group">
              <label htmlFor="flag-key-input">Flag key</label>
              <input
                id="flag-key-input"
                type="text"
                value={flagKey}
                onChange={e => setFlagKey(e.target.value)}
                placeholder="e.g. dark-mode"
                autoComplete="off"
                style={{ fontFamily: "'Menlo','Consolas',monospace" }}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: '.25rem' }}>
              {loading ? <><span className="spinner" /> Checking…</> : 'Check Flag'}
            </button>
          </form>

          {/* Result */}
          {result && (() => {
            const cfg = resultConfig[result.state]
            return (
              <div style={{
                marginTop: '1.25rem',
                padding: '1.25rem',
                borderRadius: 'var(--radius)',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                display: 'flex', alignItems: 'center', gap: 12,
                animation: 'slideIn .25s ease',
              }}>
                <span style={{ fontSize: '1.8rem' }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, color: cfg.color, fontSize: '1rem' }}>
                    {result.state === 'enabled' || result.state === 'disabled'
                      ? <><span className="mono">{result.key}</span> is {cfg.label}</>
                      : cfg.label
                    }
                  </div>
                  {result.message && (
                    <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 3 }}>
                      {result.message}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Hint */}
        <div style={{ color: 'var(--text-muted)', fontSize: '.8rem', textAlign: 'center', marginTop: '.75rem' }}>
          Flags are scoped to your organization. Try: <span className="mono" style={{ fontSize: '.78rem' }}>dark-mode</span>
        </div>
      </div>
    </>
  )
}
