import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api.js'
import { useAuth } from '../App.jsx'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const { auth, logout } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [orgError, setOrgError] = useState('')

  // Create org form
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  // Audit logs state
  const [selectedOrgFilter, setSelectedOrgFilter] = useState('')
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logsError, setLogsError] = useState('')

  const fetchOrgs = useCallback(async () => {
    setLoadingOrgs(true)
    setOrgError('')
    try {
      const data = await apiFetch('/api/organizations', { token: auth.token })
      setOrgs(data)
    } catch (err) {
      if (err.status === 401) { logout(); return }
      setOrgError(err.message || 'Failed to load organizations.')
    } finally {
      setLoadingOrgs(false)
    }
  }, [auth.token, logout])

  const fetchAuditLogs = useCallback(async (orgId = '') => {
    setLoadingLogs(true); setLogsError('')
    try {
      const url = orgId ? `/api/audit-logs?organization_id=${orgId}` : '/api/audit-logs'
      const data = await apiFetch(url, { token: auth.token })
      setAuditLogs(data)
    } catch (err) {
      setLogsError(err.message || 'Failed to load audit logs.')
    } finally { setLoadingLogs(false) }
  }, [auth.token])

  useEffect(() => {
    fetchOrgs()
    fetchAuditLogs(selectedOrgFilter)
  }, [fetchOrgs, fetchAuditLogs, selectedOrgFilter])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess('')
    if (!newName.trim()) { setCreateError('Organization name is required.'); return }
    setCreating(true)
    try {
      const org = await apiFetch('/api/organizations', {
        method: 'POST',
        body: { name: newName.trim() },
        token: auth.token,
      })
      setNewName('')
      setCreateSuccess(`"${org.name}" created successfully!`)
      fetchOrgs()
      fetchAuditLogs(selectedOrgFilter)
      setTimeout(() => setCreateSuccess(''), 4000)
    } catch (err) {
      setCreateError(err.message || 'Failed to create organization.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">🚩</div>
          <span className="logo-name">FlagFlow</span>
          <span className="role-badge">Super Admin</span>
        </div>
        <div className="header-right">
          <span className="user-email">{auth.user.email}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* Content */}
      <div className="container">
        {/* Stats */}
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Organizations</div>
            <div className="stat-value">{loadingOrgs ? '—' : orgs.length}</div>
          </div>
        </div>

        {/* Create org */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '1rem' }}>➕ Create Organization</h2>
          {createError   && <div className="alert alert-error">{createError}</div>}
          {createSuccess && <div className="alert alert-success">{createSuccess}</div>}
          <form onSubmit={handleCreate} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="org-name">Organization name</label>
                <input
                  id="org-name" type="text"
                  value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <><span className="spinner" /> Creating…</> : 'Create'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Org table */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '1rem' }}>🏢 All Organizations</h2>
          {orgError && <div className="alert alert-error">{orgError}</div>}

          {loadingOrgs ? (
            <div className="empty"><span className="spinner" /> Loading…</div>
          ) : orgs.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🏢</div>
              No organizations yet. Create one above.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>ID</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map(org => (
                    <tr key={org.id}>
                      <td><strong>{org.name}</strong></td>
                      <td><span className="mono">{org.id}</span></td>
                      <td><span className="ts">{fmtDate(org.created_at)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Global Audit Logs */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <h2 className="card-title">📜 Global Audit Logs</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Filter Org:</span>
              <select
                value={selectedOrgFilter}
                onChange={e => setSelectedOrgFilter(e.target.value)}
                style={{ fontSize: '.85rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff' }}
              >
                <option value="">All Organizations</option>
                {orgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => fetchAuditLogs(selectedOrgFilter)} disabled={loadingLogs} style={{ marginLeft: 'auto' }}>
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
                    <th>Org</th>
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
                        <td><strong>{log.organization_name || 'System'}</strong></td>
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
