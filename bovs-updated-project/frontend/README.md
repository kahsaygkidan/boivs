# BOVS Frontend — backend-mediated Keycloak login + document management

This is the original Vite/React UI wired up to the Spring Boot backend in `../backend`.

## Authentication — no redirect to Keycloak
`src/components/LoginScreen.jsx` is a normal in-app login form. On submit it calls
`POST /api/auth/login` on our own backend, which exchanges the credentials with Keycloak
server-to-server and returns an access/refresh token pair. The browser is never sent to
Keycloak's own hosted login page. See `src/auth/AuthContext.jsx` for session storage and
`src/api/client.js` for automatic silent refresh on a 401 (via `POST /api/auth/refresh`) and
`useAuth().logout()` (calls `POST /api/auth/logout`, which revokes the session in Keycloak).

## Setup
```bash
npm install
cp .env.example .env   # only needs the backend URL now
npm run dev
```

`.env`:
```
VITE_API_BASE_URL=http://localhost:8080/api
```

Demo users (see `../backend/keycloak/bovs-realm.json` for the full realm/passwords):
- `d.alemu` — MAKER
- `kahsayge` — CHECKER
- `auditor1` — AUDITOR
- `admin1` — all roles (ADMIN)

## What changed vs. the previous iteration
- Removed `keycloak-js` and the `login-required` redirect entirely.
- Added `src/auth/AuthContext.jsx` — backend-mediated login/refresh/logout, session kept in
  `sessionStorage` (cleared on tab close).
- Added `src/components/LoginScreen.jsx` — the app's own login page.
- Added `src/views/RecordDetail.jsx` — click any BO reference to open a full record view with:
  identity/ownership details, **document list with download and delete**, an upload form
  (MAKER/ADMIN), inline approve/reject/cease actions (CHECKER/ADMIN), and the record's audit
  trail (AUDITOR/ADMIN).
- `src/api/bovsApi.js` gained `downloadDocument` (streams the file and triggers a browser
  save) and `deleteDocument`.
- `Dashboard.jsx` / `Records.jsx` / `Queue.jsx` rows now open `RecordDetail` on click.

## Notes
- Role-based UI hiding (nav items, buttons) is a UX convenience only — the backend enforces
  the real authorization via `@PreAuthorize`, so a hidden button is not the security boundary.
- Access tokens live in `sessionStorage`; consider moving to an httpOnly cookie set by the
  backend if you need protection against token theft via XSS in a hardened deployment.
