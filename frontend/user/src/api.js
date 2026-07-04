const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()
  if (!json.success) {
    const err = new Error(json.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return json.data
}
