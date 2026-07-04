import { useState, useEffect, createContext, useContext } from 'react'
import { apiFetch } from './api.js'
import LoginForm from './components/LoginForm.jsx'
import Dashboard from './components/Dashboard.jsx'

// ── Auth Context ─────────────────────────────────────────────────────────────
export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const STORAGE_KEY = 'sa_auth'

export default function App() {
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const login = (token, user) => {
    const authData = { token, user }
    setAuth(authData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authData))
  }

  const logout = () => {
    setAuth(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  // Verify stored token is still valid on boot
  useEffect(() => {
    if (!auth?.token) return
    apiFetch('/api/organizations', { token: auth.token })
      .catch(err => {
        if (err.status === 401) logout()
      })
  }, []) // eslint-disable-line

  const value = { auth, login, logout }

  return (
    <AuthContext.Provider value={value}>
      <div className="page">
        {auth ? <Dashboard /> : <LoginForm />}
      </div>
    </AuthContext.Provider>
  )
}
