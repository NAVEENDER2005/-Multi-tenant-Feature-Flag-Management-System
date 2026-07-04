import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api.js'
import { useAuth } from '../App.jsx'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const { auth, logout } = useAuth()
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState('')

  // Create flag form state
  const [newKey, setNewKey] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newEnabled, setNewEnabled] = useState(false)
  const [newRollout, setNewRollout] = useState(100)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logsError, setLogsError] = useState('')

  // Per-flag toggling in progress
  const [togglingId, setTogglingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const fetchAuditLogs = useCallback(async () => {
    setLoadingLogs(true); setLogsError('')
    try {
      const data = await apiFetch('/api/audit-logs', { token: auth.token })
      setAuditLogs(data)
    } catch (err) {
      setLogsError(err.message || 'Failed to load audit logs.')
    } finally { setLoadingLogs(false) }
  }, [auth.token])

  const fetchFlags = useCallback(async () => {
    setLoading(true); setListError('')
    try {
      const data = await apiFetch('/api/flags', { token: auth.token })
      setFlags(data)
    } catch (err) {
      if (err.status === 401) { logout(); return }
      setListError(err.message || 'Failed to load flags.')
    } finally { setLoading(false) }
  }, [auth.token, logout])

  useEffect(() => {
    fetchFlags()
    fetchAuditLogs()
  }, [fetchFlags, fetchAuditLogs])

  const handleCreate = async (e) => {
    e.preventDefault(); setCreateError(''); setCreateSuccess('')
    if (!newKey.trim()) { setCreateError('Flag key is required.'); return }
    setCreating(true)
    try {
      const flag = await apiFetch('/api/flags', {
        method: 'POST',
        body: { 
          key: newKey.trim(), 
          description: newDesc.trim() || undefined, 
          is_enabled: newEnabled,
          rollout_percentage: newRollout 
        },
        token: auth.token,
      })
      setFlags(prev => [flag, ...prev])
      setNewKey(''); setNewDesc(''); setNewEnabled(false); setNewRollout(100)
      setCreateSuccess(`Flag "${flag.key}" created!`)
      setTimeout(() => setCreateSuccess(''), 3500)
      fetchAuditLogs()
    } catch (err) {
      setCreateError(err.message || 'Failed to create flag.')
    } finally { setCreating(false) }
  }

  const handleToggle = async (flag) => {
    setTogglingId(flag.id)
    try {
      const updated = await apiFetch(`/api/flags/${flag.id}`, {
        method: 'PATCH',
        body: { is_enabled: !flag.is_enabled },
        token: auth.token,
      })
      setFlags(prev => prev.map(f => f.id === updated.id ? updated : f))
      fetchAuditLogs()
    } catch (err) {
      if (err.status === 401) { logout(); return }
      alert(err.message || 'Failed to update flag.')
    } finally { setTogglingId(null) }
  }

  const handleRolloutUpdate = async (flag, newPercentage) => {
    const value = Math.max(0, Math.min(100, parseInt(newPercentage, 10) || 0))
    try {
      const updated = await apiFetch(`/api/flags/${flag.id}`, {
        method: 'PATCH',
        body: { rollout_percentage: value },
        token: auth.token,
      })
      setFlags(prev => prev.map(f => f.id === updated.id ? updated : f))
    } catch (err) {
      alert(err.message || 'Failed to update rollout percentage.')
    }
  }

  const handleDelete = async (flag) => {
    if (!confirm(`Delete flag "${flag.key}"? This cannot be undone.`)) return
    setDeletingId(flag.id)
    try {
      await apiFetch(`/api/flags/${flag.id}`, { method: 'DELETE', token: auth.token })
      setFlags(prev => prev.filter(f => f.id !== flag.id))
      fetchAuditLogs()
    } catch (err) {
      if (err.status === 401) { logout(); return }
      alert(err.message || 'Failed to delete flag.')
    } finally { setDeletingId(null) }
  }

  const enabledCount = flags.filter(f => f.is_enabled).length;

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">🚩</div>
          <span className="logo-name">FlagFlow</span>
          <span className="role-badge">Org Admin</span>
        </div>
        <div className="header-right">
          <span className="user-email">{auth.user.email}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className="container">
        {/* Stats */}
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Total Flags</div>
            <div className="stat-value">{loading ? '—' : flags.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Enabled</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{loading ? '—' : enabledCount}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Disabled</div>
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{loading ? '—' : flags.length - enabledCount}</div>
          </div>
        </div>

        {/* Create flag */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '1rem' }}>➕ New Feature Flag</h2>
          {createError   && <div className="alert alert-error">{createError}</div>}
          {createSuccess && <div className="alert alert-success">{createSuccess}</div>}
          <form onSubmit={handleCreate} noValidate>
            <div className="form-row" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ minWidth: 140 }}>
                <label htmlFor="flag-key">Key *</label>
                <input id="flag-key" type="text"
                  value={newKey} onChange={e => setNewKey(e.target.value)}
                  placeholder="e.g. dark-mode" />
              </div>
              <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
                <label htmlFor="flag-desc">Description</label>
                <input id="flag-desc" type="text"
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="Optional description" />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8, alignItems: 'center' }}>
              <label className="toggle" title="Enable flag immediately">
                <input type="checkbox" checked={newEnabled} onChange={e => setNewEnabled(e.target.checked)} />
                <span className="toggle-track" />
                <span style={{ marginLeft: 8, fontSize: '.85rem', color: 'var(--text-muted)' }}>
                  {newEnabled ? 'Enabled on create' : 'Disabled on create'}
                </span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Rollout:</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={newRollout} 
                  onChange={e => setNewRollout(Number(e.target.value))} 
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: '.85rem', fontWeight: 600, minWidth: 35 }}>{newRollout}%</span>
              </div>

              <button type="submit" className="btn btn-primary" disabled={creating} style={{ marginLeft: 'auto' }}>
                {creating ? <><span className="spinner" /> Creating…</> : 'Create Flag'}
              </button>
            </div>
          </form>
        </div>

        {/* Flags table */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <h2 className="card-title">🏳️ Feature Flags</h2>
            <input 
              type="text" 
              placeholder="Search by key/description..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              style={{ width: 220, fontSize: '.85rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff' }}
            />
            <button className="btn btn-ghost btn-sm" onClick={fetchFlags} disabled={loading} style={{ marginLeft: 'auto' }}>
              {loading ? <span className="spinner" /> : '↻ Refresh'}
            </button>
          </div>
          {listError && <div className="alert alert-error">{listError}</div>}

          {loading ? (
            <div className="empty"><span className="spinner" /> Loading flags…</div>
          ) : flags.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🏳️</div>
              No flags yet. Create your first feature flag above.
            </div>
          ) : (() => {
            const filteredFlags = flags.filter(flag => {
              const keyMatch = flag.key.toLowerCase().includes(searchQuery.toLowerCase());
              const descMatch = (flag.description || '').toLowerCase().includes(searchQuery.toLowerCase());
              return keyMatch || descMatch;
            });

            if (filteredFlags.length === 0) {
              return <div className="empty">No matching flags found.</div>;
            }

            return (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Description</th>
                      <th>Rollout</th>
                      <th>Status</th>
                      <th>Enabled</th>
                      <th>Updated</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFlags.map(flag => (
                      <tr key={flag.id} style={{ opacity: deletingId === flag.id ? 0.4 : 1, transition: 'opacity .2s' }}>
                        <td><span className="mono">{flag.key}</span></td>
                        <td style={{ color: flag.description ? 'var(--text)' : 'var(--text-muted)', fontStyle: flag.description ? 'normal' : 'italic', fontSize: '.85rem' }}>
                          {flag.description || 'No description'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input 
                              type="number" 
                              min="0" 
                              max="100" 
                              value={flag.rollout_percentage !== undefined ? flag.rollout_percentage : 100}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, rollout_percentage: val } : f))
                              }}
                              onBlur={(e) => handleRolloutUpdate(flag, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRolloutUpdate(flag, e.target.value);
                                  e.target.blur();
                                }
                              }}
                              style={{ width: 55, fontSize: '.8rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`pill ${flag.is_enabled ? 'pill-on' : 'pill-off'}`}>
                            {flag.is_enabled ? '● On' : '○ Off'}
                          </span>
                        </td>
                        <td>
                          <label className="toggle" title={`Toggle ${flag.key}`}>
                            <input
                              type="checkbox"
                              checked={flag.is_enabled}
                              disabled={togglingId === flag.id}
                              onChange={() => handleToggle(flag)}
                            />
                            <span className="toggle-track" />
                          </label>
                          {togglingId === flag.id && <span className="spinner" style={{ marginLeft: 6 }} />}
                        </td>
                        <td><span className="ts">{fmtDate(flag.updated_at)}</span></td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(flag)}
                            disabled={deletingId === flag.id}
                          >
                            {deletingId === flag.id ? <span className="spinner" /> : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        {/* Audit Logs */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h2 className="card-title">📜 Audit Logs</h2>
            <button className="btn btn-ghost btn-sm" onClick={fetchAuditLogs} disabled={loadingLogs}>
              {loadingLogs ? <span className="spinner" /> : '↻ Refresh'}
            </button>
          </div>
          {logsError && <div className="alert alert-error">{logsError}</div>}
          
          {loadingLogs ? (
            <div className="empty"><span className="spinner" /> Loading audit logs…</div>
          ) : auditLogs.length === 0 ? (
            <div className="empty">No recent activity logged.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Flag Key</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => {
                    const actionColors = {
                      created: 'rgba(56, 189, 248, 0.2)', // light blue
                      enabled: 'rgba(16, 185, 129, 0.2)', // green
                      disabled: 'rgba(156, 163, 175, 0.2)', // gray
                      deleted: 'rgba(239, 68, 68, 0.2)' // red
                    };
                    const textColors = {
                      created: '#38bdf8',
                      enabled: '#10b981',
                      disabled: '#9ca3af',
                      deleted: '#ef4444'
                    };
                    return (
                      <tr key={log.id}>
                        <td><span className="ts">{new Date(log.timestamp).toLocaleString()}</span></td>
                        <td><span style={{ fontSize: '.85rem' }}>{log.user_email}</span></td>
                        <td>
                          <span className="pill" style={{ background: actionColors[log.action] || '#444', color: textColors[log.action] || '#fff', fontWeight: 600 }}>
                            {log.action}
                          </span>
                        </td>
                        <td><span className="mono">{log.flag_key}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
