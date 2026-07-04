# FlagFlow — Multi-Tenant Feature Flag Management System

A complete, production-structured feature flag system with multi-tenancy, three role-based portals, and a single-command dev startup.

---

## Quick Start

```bash
# 1. Clone / enter the project
cd feature-flag-system

# 2. Install all dependencies (root + server + 3 frontends)
npm run install:all

# 3. Seed the database with sample data
npm run seed

# 4. Start everything
npm run dev
```

That's it. Four processes start concurrently:

| Process     | URL                         | Role        |
|-------------|-----------------------------|-------------|
| API server  | http://localhost:4000       | Backend     |
| Super Admin | http://localhost:5173       | super_admin |
| Org Admin   | http://localhost:5174       | org_admin   |
| End User    | http://localhost:5175       | end_user    |

### Seeded Test Credentials

| Role        | Email                     | Password      |
|-------------|---------------------------|---------------|
| Super Admin | superadmin@example.com    | superadmin123 |
| Org Admin   | admin@acme.com            | admin123      |
| End User    | user@acme.com             | user123       |

Seeded flags (under "Acme Corp"):
- `dark-mode` — enabled ✅
- `new-dashboard` — disabled ❌
- `smart-suggestions` — disabled ❌

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌─────────────────┐  ┌───────────┐  ┌───────────────┐ │
│  │  Super Admin    │  │   Admin   │  │   End User    │ │
│  │  React/Vite     │  │ React/Vite│  │  React/Vite   │ │
│  │  :5173          │  │   :5174   │  │    :5175      │ │
│  └────────┬────────┘  └─────┬─────┘  └──────┬────────┘ │
└───────────┼─────────────────┼───────────────┼──────────┘
            │                 │               │
            └─────────────────┴───────────────┘
                              │
                  HTTP Bearer JWT → VITE_API_URL
                              │
            ┌─────────────────▼──────────────────┐
            │       Express  :4000  /api/*        │
            │                                     │
            │  Middleware chain:                  │
            │    requireAuth   → verifies JWT     │
            │    requireRole   → checks role      │
            │    requireSameOrg → org isolation   │
            │                                     │
            │  Routes:                            │
            │    POST /api/auth/login             │
            │    POST /api/auth/signup            │
            │    GET/POST /api/organizations      │
            │    GET /api/organizations/public    │
            │    GET/POST /api/flags              │
            │    PATCH/DELETE /api/flags/:id      │
            │    GET /api/flags/check/:key        │
            └─────────────────┬──────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  better-sqlite3    │
                    │  feature_flags.db  │
                    │  (single file)     │
                    └────────────────────┘
```

### Data Flow

1. User logs in → backend checks super admin env creds OR queries `users` table
2. On success → JWT signed with `{ sub, role, organization_id }`, 12h expiry
3. Every subsequent request → Bearer token decoded → `req.user` populated
4. For write operations → `organization_id` is read **exclusively from `req.user`** (never from request body)

---

## Project Structure

```
.
├── package.json              # Root — concurrently starts all 4 processes
├── README.md
│
├── server/
│   ├── index.js              # Express entry point, CORS, route mounting
│   ├── db.js                 # SQLite singleton + schema init (runs on boot)
│   ├── seed.js               # Idempotent seed script
│   ├── .env                  # (gitignore in production)
│   ├── .env.example
│   ├── middleware/
│   │   ├── requireAuth.js    # JWT verification → req.user
│   │   ├── requireRole.js    # Role gate factory
│   │   └── requireSameOrg.js # Cross-org isolation
│   └── routes/
│       ├── auth.js           # /api/auth/*
│       ├── organizations.js  # /api/organizations/*
│       └── flags.js          # /api/flags/*
│
└── frontend/
    ├── super-admin/          # Vite React app — manage organizations
    ├── admin/                # Vite React app — manage feature flags
    └── user/                 # Vite React app — check flag status
        (each has src/{App,api,index.css,main}.jsx + components/)
```

---

## API Reference

### Public
```
GET  /api/health                    → { status: 'ok' }
GET  /api/organizations/public      → [{ id, name }]
POST /api/auth/login                → { token, user }
POST /api/auth/signup               → { id, email, role, organization_id }
```

### Super Admin (role: super_admin)
```
GET  /api/organizations             → [{ id, name, created_at }]
POST /api/organizations             body: { name } → org object
```

### Org Admin (role: org_admin, org-scoped via JWT)
```
GET    /api/flags                   → [flag]
POST   /api/flags                   body: { key, description?, is_enabled? } → flag
PATCH  /api/flags/:id               body: { is_enabled?, description? } → flag
DELETE /api/flags/:id               → { id, deleted: true }
```

### End User (role: end_user, org-scoped via JWT)
```
GET  /api/flags/check/:key          → { key, enabled: boolean }
```

### Response Envelope
Every response follows: `{ success: boolean, data?: any, error?: string }`

---

## Engineering Trade-offs (Explicit)

### 1. SQLite over PostgreSQL / MongoDB
**Decision:** SQLite via `better-sqlite3`.

**Why:** This system's scope is a single-server deployment for a code review or small team. SQLite requires zero infrastructure — no Docker, no connection string management, no migrations tooling. `better-sqlite3` is synchronous, which makes error handling straightforward. The database is a single file (`feature_flags.db`) that persists to disk and can be copied, backed up with `cp`, or inspected with any SQLite GUI.

**Trade-off:** SQLite's write concurrency is limited (one writer at a time). For a production multi-tenant system with high write throughput, PostgreSQL is the right choice.

---

### 2. JWT with no refresh token
**Decision:** Single 12-hour access token; no refresh token issued.

**Why:** For this scope, re-login on expiry is acceptable. Adding refresh tokens requires a token store (to support revocation), a separate `/auth/refresh` endpoint, secure `httpOnly` cookie handling, and rotation logic. That's meaningful complexity for a system where sessions are expected to be short-lived admin sessions.

**Trade-off:** Users who leave the tab open overnight will be logged out. In production, add a refresh token stored in an `httpOnly` cookie with rotation-on-use and a revocation list.

---

### 3. Super admin is env-based, not a DB row
**Decision:** `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` are read from environment variables. The super admin never appears in the `users` table.

**Why:** A super admin is a privileged operations role — not a regular user. Storing it in the DB would require a bootstrap problem (who creates the first super admin?), and making it self-service would be a security anti-pattern. Env-based credentials are consistent with how production systems handle service-level secrets (see: Kubernetes secrets, AWS Secrets Manager).

**Trade-off:** Only one super admin can exist, and changing credentials requires a server restart. In a real product you'd want multiple super admins with DB rows, RBAC, audit logs for all their actions, and MFA.

---

### 4. organization_id is always taken from the JWT server-side
**Decision:** On every write path, `organization_id` is read from `req.user.organization_id` (the decoded JWT), never from the request body, URL params, or query string.

**Why:** This is the **core multi-tenancy security boundary**. If the client controlled `organization_id`, any org admin could claim to belong to another organization and read or modify that org's flags. By anchoring `organization_id` to the JWT (which is server-signed), an org admin is structurally incapable of escaping their own org, even with a crafted request. The `requireSameOrg` middleware additionally verifies that the specific flag being addressed belongs to the requesting user's org, and returns `404` (not `403`) to avoid leaking the existence of cross-org resources.

---

### 5. End users use the same signup endpoint as org admins
**Decision:** End users self-register via the `/api/auth/signup` endpoint with `role: 'end_user'`. The user app has a "Create account" tab for this.

**Why:** Simplifies the API surface — one signup endpoint handles both roles. The role field is validated server-side to prevent escalation (you cannot signup as `super_admin` via this endpoint). In production you'd likely invite end users via email rather than allowing self-signup, and add email verification.

---

## Implemented Core Features & Enhancements

In addition to the baseline monorepo architecture, the following production-grade features have been successfully implemented:

1. **Audit Logs (Flag Activity History)**:
   * A persistent `audit_logs` database table records all key flag actions: `created`, `enabled`, `disabled`, and `deleted`.
   * Org admins have access to an **Audit Logs** history table on their dashboard scoped strictly to their organization's activities.
   * Super admins have access to a **Global Audit Logs** panel showing activities across all organizations, with support for real-time organization-based filtering.
   * Available at: `GET /api/audit-logs`.

2. **Gradual Rollout Percentage**:
   * Enables gradual feature release targeting (from 0% to 100%).
   * Uses a deterministic non-cryptographic hashing algorithm (`hashUserId(userId + flagKey) % 100`) server-side to guarantee a stable rollout group assignment per end-user.
   * Org admins can adjust the rollout percentage using a slider when creating flags, or edit the percentage inline in the flags table on the Admin Dashboard.

3. **Flag Search & Filtering**:
   * Org admins can filter flags in real-time by flag key or description from their dashboard search input.

4. **Forgot & Reset Password Flow**:
   * Implemented custom password recovery and reset endpoints at `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` (with token expiration and minimum complexity checks).

5. **SaaS Light Theme**:
   * Replaced the default dark theme with a clean, high-fidelity light theme layout (pure white surfaces, slate texts, soft light-gray backgrounds, and vibrant blue brand accents) modeled after premium SaaS templates.

---

## What I'd Add for Production-Readiness

These are intentionally out of scope but are the obvious next steps:

| Feature | Reason skipped |
|---|---|
| **Rate limiting** (`express-rate-limit`) | Not needed at zero traffic |
| **Refresh tokens** | Adds complexity without benefit at this scope |
| **Email verification** | Requires email infra (SMTP/SES) |
| **Pagination** | No dataset large enough to need it yet |
| **Soft deletes** | Tradeoff: simpler restore vs. more complex queries |
| **RBAC beyond 3 roles** | Would require a permissions table |
| **HTTPS / TLS** | Use a reverse proxy (nginx/Caddy) in production |
| **Helmet.js security headers** | Easy to add, skipped for dev clarity |
| **Docker / docker-compose** | Mentioned as optional future step |
| **PostgreSQL migration** | Swap `better-sqlite3` for `pg` when scaling |
| **Input sanitization** | `key` field has basic regex; full sanitization needed |
| **Tests** | Unit tests for middleware, integration tests for routes |

---

## Docker (Optional Future Step)

```dockerfile
# Dockerfile sketch — not included in this project
FROM node:20-alpine
WORKDIR /app
COPY server/ ./server/
RUN npm install --prefix server
CMD ["node", "server/index.js"]
```

A `docker-compose.yml` would orchestrate the server container plus the three frontend build outputs served by nginx.
