import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import { useAuth } from '../App.jsx'

export default function AuthScreen() {
  const { login } = useAuth()
  const [tab, setTab] = useState('login') // 'login' | 'signup'

  // Shared fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgId, setOrgId] = useState('')
  const [orgs, setOrgs] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [orgsLoading, setOrgsLoading] = useState(false)

  // Load orgs for dropdown
  useEffect(() => {
    setOrgsLoading(true)
    apiFetch('/api/organizations/public')
      .then(data => { setOrgs(data); if (data.length > 0) setOrgId(data[0].id) })
      .catch(() => setError('Could not load organizations. Is the server running?'))
      .finally(() => setOrgsLoading(false))
  }, [])

  const reset = () => { setEmail(''); setPassword(''); setError('') }

  const handleLogin = async (e) => {
    e.preventDefault(); setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } })
      if (data.user.role !== 'org_admin') { setError('This portal is for org admins only.'); return }
      login(data.token, data.user)
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally { setLoading(false) }
  }

  const handleSignup = async (e) => {
    e.preventDefault(); setError('')
    if (!email || !password || !orgId) { setError('All fields are required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: { email, password, role: 'org_admin', organization_id: orgId },
      })
      // Auto-login after signup
      const data = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } })
      login(data.token, data.user)
    } catch (err) {
      setError(err.message || 'Signup failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="center-wrap">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="logo-icon">🚩</div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>FlagFlow</span>
          <span className="role-badge">Org Admin</span>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); reset() }}>
            Sign in
          </button>
          <button className={`tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); reset() }}>
            Create account
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" type="email" autoComplete="username"
                value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <><span className="spinner" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} noValidate>
            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <input id="signup-email" type="email" autoComplete="username"
                value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <input id="signup-password" type="password" autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" />
            </div>
            <div className="form-group">
              <label htmlFor="signup-org">Organization</label>
              <select id="signup-org" value={orgId} onChange={e => setOrgId(e.target.value)}
                disabled={orgsLoading}>
                {orgsLoading
                  ? <option>Loading…</option>
                  : orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)
                }
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label>Role</label>
              <input type="text" value="Org Admin" disabled style={{ opacity: .6 }} />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading || orgsLoading}>
              {loading ? <><span className="spinner" /> Creating account…</> : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
