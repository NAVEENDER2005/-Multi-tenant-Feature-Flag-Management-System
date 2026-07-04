import { useState, useEffect, createContext, useContext } from 'react'
import { apiFetch } from './api.js'
import AuthScreen from './components/AuthScreen.jsx'
import Dashboard from './components/Dashboard.jsx'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const STORAGE_KEY = 'user_auth'

export default function App() {
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
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

  // Validate stored token on boot
  useEffect(() => {
    if (!auth?.token) return
    apiFetch('/api/flags/check/__ping__', { token: auth.token })
      .catch(err => { if (err.status === 401) logout() })
  }, []) // eslint-disable-line

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      <div className="page">
        {auth ? <Dashboard /> : <AuthScreen />}
      </div>
    </AuthContext.Provider>
  )
}
