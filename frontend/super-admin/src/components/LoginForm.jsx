import { useState } from 'react'
import { apiFetch } from '../api.js'
import { useAuth } from '../App.jsx'

export default function LoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter email and password.'); return }
    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } })
      if (data.user.role !== 'super_admin') {
        setError('This portal is for super admins only.')
        return
      }
      login(data.token, data.user)
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center-wrap">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="logo-icon">🚩</div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>FlagFlow</span>
          <span className="role-badge">Super Admin</span>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in with your super admin credentials</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" autoComplete="username"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="superadmin@example.com"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="password">Password</label>
            <input
              id="password" type="password" autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in…</> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
