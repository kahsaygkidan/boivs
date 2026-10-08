# BO Verification System — Backend

Spring Boot backend for the Beneficial Owner Verification System (BOVS), secured with
**Keycloak** and implementing a **Maker → Checker → Auditor/Admin** workflow.
Runs against **PostgreSQL** or **Oracle** via Spring profiles.

## Stack
- Java 21, Spring Boot 3.3, built with Maven
- Spring Security OAuth2 Resource Server (validates Keycloak-issued JWTs on every `/api/**` call)
- Spring Data JPA + Flyway (schema per database, `db/migration/postgres` and `db/migration/oracle`)
- springdoc-openapi (Swagger UI at `/swagger-ui.html`)

## Authentication model — backend-mediated login, no Keycloak redirect
The browser **never** navigates to Keycloak's own hosted login page. Instead:

1. The SPA's own login form posts `{ username, password }` to `POST /api/auth/login`.
2. `AuthController` → `KeycloakAuthService` exchanges those credentials with Keycloak's token
   endpoint **server-to-server**, using the confidential `bovs-backend` client
   (`grant_type=password`). The client secret never reaches the browser.
3. The backend returns `{ accessToken, refreshToken, expiresIn, username, roles }` to the SPA,
   which then sends the access token as a normal `Authorization: Bearer ...` header on every
   subsequent `/api/**` call — validated as usual by the OAuth2 resource server filter.
4. `POST /api/auth/refresh` and `POST /api/auth/logout` do the equivalent refresh/revoke calls
   against Keycloak, again server-side.

`/api/auth/**` is the only part of the API that is `permitAll()`; everything else requires a
valid bearer token, same as before.

## Roles
| Role     | Can do |
|----------|--------|
| MAKER    | Register legal persons & BO records, upload/delete documents, submit records for verification |
| CHECKER  | View the verification queue, approve/reject/cease records (cannot approve their own submissions) |
| AUDITOR  | Read-only access to all records, documents, and the full audit trail |
| ADMIN    | Everything above, including overriding segregation-of-duties |

Roles come from the Keycloak JWT's `realm_access.roles`, mapped to Spring authorities
`ROLE_MAKER`, `ROLE_CHECKER`, `ROLE_AUDITOR`, `ROLE_ADMIN` by `KeycloakRoleConverter`.

## Workflow
`DRAFT → PENDING → VERIFIED → CEASED`, with `PENDING → REJECTED → PENDING` (resubmission) also
possible. Every transition, document upload, and document deletion is written to `audit_log`
with actor, roles, action, and details.

## Document management
- `POST /api/bo-records/{boId}/documents` (multipart, MAKER/ADMIN) — upload
- `GET /api/bo-records/{boId}/documents` (all roles) — list
- `GET /api/bo-records/{boId}/documents/{docId}/download` (all roles) — download the original file
- `DELETE /api/bo-records/{boId}/documents/{docId}` (MAKER/ADMIN) — delete (removes the file
  from disk and the DB record, and writes a `DOCUMENT_DELETED` audit entry)

Files are stored under `bovs.storage.documents-dir` (default `./bovs-documents`), one
subfolder per BO reference.

## Running locally with Docker Compose
```bash
docker compose up --build
```
This starts Postgres, a Postgres-backed Keycloak (importing `keycloak/bovs-realm.json` with the
four roles, the confidential `bovs-backend` client used for login/refresh/logout, and demo
users — see the realm file for usernames/passwords), and the backend on port 8080.

- Backend API: http://localhost:8080/api
- Swagger UI: http://localhost:8080/swagger-ui.html
- Keycloak admin console: http://localhost:8081 (admin/admin)

**Change `KEYCLOAK_AUTH_CLIENT_SECRET`** (and the matching secret in
`keycloak/bovs-realm.json`) before deploying anywhere beyond your own machine.

## Running without Docker
1. Create a Postgres database `bovs` (or point `DB_URL`/`DB_USERNAME`/`DB_PASSWORD` at Oracle
   and run with `SPRING_PROFILES_ACTIVE=oracle`).
2. Start Keycloak separately, import `keycloak/bovs-realm.json`.
3. Export environment variables (see `application.yml` for the full list / defaults), e.g.:
   ```bash
   export KEYCLOAK_ISSUER_URI=http://localhost:8081/realms/bovs
   export KEYCLOAK_BASE_URL=http://localhost:8081
   export KEYCLOAK_REALM=bovs
   export KEYCLOAK_AUTH_CLIENT_ID=bovs-backend
   export KEYCLOAK_AUTH_CLIENT_SECRET=change-me-in-production
   export DB_URL=jdbc:postgresql://localhost:5432/bovs
   export DB_USERNAME=bovs
   export DB_PASSWORD=bovs
   ```
4. `mvn spring-boot:run`

## Switching database
Set `spring.profiles.active=oracle` (or `postgres`, the default) — this selects both the
JDBC driver/dialect and the matching Flyway migration folder. No code changes needed.

## Key endpoints
- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` — public
- `POST /api/legal-persons`, `GET /api/legal-persons` — MAKER/ADMIN create, all roles read
- `POST /api/bo-records?submit=true|false` — MAKER/ADMIN create (draft or submitted)
- `POST /api/bo-records/{id}/submit` — MAKER/ADMIN
- `GET /api/bo-records/queue` — CHECKER/ADMIN, records pending verification
- `POST /api/bo-records/{id}/approve` — CHECKER/ADMIN
- `POST /api/bo-records/{id}/reject` — CHECKER/ADMIN, body `{ "reason": "..." }`
- `POST /api/bo-records/{id}/cease` — CHECKER/ADMIN
- `GET /api/bo-records` — all roles, filter by `status`, `pep`, `createdBy`, `q`
- `POST /api/bo-records/{id}/documents`, `GET .../documents/{id}/download`, `DELETE .../{id}` — see above
- `GET /api/audit-logs` — AUDITOR/ADMIN
- `GET /api/dashboard/stats` — all roles
- `GET /api/me` — resolves current username + roles from the token

## Security notes
- All `/api/**` requests (other than `/api/auth/**`) must present a valid Keycloak-issued
  bearer JWT; the resource server validates it against `KEYCLOAK_ISSUER_URI`'s JWKS endpoint.
- Method-level `@PreAuthorize` enforces role checks per endpoint.
- Segregation of duties: a CHECKER cannot approve/reject a record they created themselves
  (ADMIN is exempt, for break-glass situations).
- CORS is restricted to `BOVS_ALLOWED_ORIGINS` (defaults to the Vite dev server).
- The `bovs-backend` Keycloak client secret is a server-side secret — keep it out of source
  control in real deployments (inject via `KEYCLOAK_AUTH_CLIENT_SECRET`).

## Building
```bash
mvn clean package        # requires network access to Maven Central
java -jar target/bo-verification-backend.jar
```
