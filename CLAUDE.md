# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
cd backend && npm run dev              # Backend :3000 (SQLite default)
cd client && npm run dev               # Frontend :5173 (Vite HMR)

# Build & Lint
cd client && npm run build             # Production build → client/dist/
cd client && npm run lint              # ESLint check

# Production (after build)
pm2 start ecosystem.config.js          # Single port 6002, frontend+backend merged

# Backend only (requires .env or env vars: SESSION_SECRET, JWT_SECRET, ENCRYPTION_KEY)
cd backend && node app.js
```

## Architecture

**Supervisor management dashboard** — Web GUI for managing Supervisor process instances across multiple servers via XML-RPC.

```
Browser → Express API (:6002) → XML-RPC → Supervisor (:9001)
                ↕                          (start/stop/restart/reload)
           Socket.io (real-time logs)
```

### Key patterns

- **DB Proxy** (`backend/models/db.js`): Auto-selects SQLite (default) or MySQL based on `STORAGE_TYPE`. Uses Proxy pattern — all method calls wait for async initialization. Both DB implementations export identical 32-method APIs.
- **Auth middleware** (`backend/middleware/auth.js`): JWT token verification → `verifyToken` on all data endpoints, `checkAdmin` on management endpoints.
- **Permission chain**: `checkUserSpecificProgramPermission` → program-level first, falls back to `checkUserProjectPermission` → 403 if neither.
- **Program ID format**: `${projectId}-${programName}`. Parsed by `utils/programId.js`. The first `-` separates project ID from program name.
- **Frontend API** (`client/src/utils/api.js`): 30+ functions wrapped around axios instance. Base URL is relative `/api` in production (same-origin), configurable via `VITE_API_URL` in dev.
- **5-sec process cache** (`supervisorService.js`): `getAllProcessInfo` results cached. Cleared on any start/stop/restart/reload operation.

### Route modules (backend/routes/)

| File | Scope |
|------|-------|
| `auth.js` | Login (rate-limited), logout, user info |
| `projects.js` | Machine CRUD, connection status |
| `programs.js` | Program list, detail, start/stop/restart, batch ops, reload |
| `users.js` | User CRUD, role management, project/program permissions |
| `groups.js` | Project group management |
| `index.js` | Root + mounts all sub-routers |

### Deploy targets

| Server | Path | Port | Jump |
|--------|------|------|------|
| mxcc (old) | `/opt/superD/` | 6002 | `ssh mxcc` → `192.168.4.107` |
| gfxcc (new) | `/data/superD/` | 6002 | `ssh gfxcc` → `10.20.48.100` |

### Frontend pages

- `ProgramsPage.jsx`: Main dashboard — sidebar tree (groups→machines), program table, batch action buttons, auto-refresh every 10s
- `LoginPage.jsx`: Clean login form
- `ProgramDetailPage.jsx`: Log drawer with Socket.io real-time terminal
- `UsersPage.jsx`: User management modal with permission configuration
