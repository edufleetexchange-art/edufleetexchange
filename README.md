# eduFleet Exchange — Server

Backend API for the eduFleet Exchange platform: a marketplace for Indian K-12 institutes covering vehicles (school buses), teacher job listings, and education suppliers, monetised via per-persona subscription plans.

## Stack

- Node.js 20+, TypeScript (ESM)
- Express 5
- MongoDB via Mongoose 9
- JWT cookies + bcryptjs
- Vitest + supertest + mongodb-memory-server for tests

## Repo layout

The server lives in the `server/` subdirectory of this repo.

- `server/models/` — Mongoose schemas: `Account`, `InstituteProfile`, `TeacherProfile`, `VendorProfile`, `StaffProfile`, `Subscription`, plus marketplace entities (Vehicle, Job, Supplier, Ad, etc.)
- `server/controllers/` — Express handlers
- `server/routes/` — Route mounting
- `server/services/` — Cross-document business logic (`authService` for transactional persona signups, `subscriptionService` for atomic quota updates)
- `server/middleware/` — `authenticate`, `requireRole`, persona access, file upload
- `server/config/` — App config, DB connection, JWT, CORS
- `server/scripts/seedData/` — Dev data seeding (`npm run seed`)
- `server/tests/` — Vitest tests

## Architecture: Account + Profile + Subscription

The User god-schema was decomposed into three layers:
- **`Account`** — identity/auth (`name`, `email`, `password`, `role`, `phone`, `avatar`)
- **Persona profile** (one of `InstituteProfile`, `TeacherProfile`, `VendorProfile`, `StaffProfile`) — 1:1 with the account, holds role-specific fields
- **`Subscription`** — its own collection, atomic quota counters, partial unique index enforcing at most one active sub per account

Auth middleware loads the bundle once per request: `req.account`, `req.profile`, `req.subscription`. See [`docs/superpowers/specs/2026-05-24-user-decomposition-design.md`](docs/superpowers/specs/2026-05-24-user-decomposition-design.md) for the full design.

## Run

```bash
cd server
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, etc.
npm run dev            # tsx watch on PORT (default 5000)
npm test               # run vitest
npm run seed:reset     # truncate + reseed all six default personas
```

## Seeded credentials (dev only — password is `password123` for all)

| Email | Role |
|---|---|
| admin@edufleet.test | admin |
| institute1@edufleet.test | institute |
| teacher1@edufleet.test | teacher |
| vendor1@edufleet.test | vendor |
| marketing1@edufleet.test | marketing |
| sales1@edufleet.test | sales |

## API surface (auth-relevant)

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/institute/signup` | Create Account + InstituteProfile + Subscription |
| POST | `/api/auth/teacher/signup` | Create Account + TeacherProfile + Subscription |
| POST | `/api/auth/vendor/signup` | Create Account + VendorProfile + Subscription |
| POST | `/api/auth/login` | Returns `{ account, profile, subscription }` + cookie |
| GET  | `/api/auth/me` | Same bundle for the authenticated account |
| PATCH | `/api/accounts/me` | Update `name`, `phone`, or `avatar` |
| GET  | `/api/teachers` | List teachers (filter by subject, minExperience, location) |
| GET  | `/api/institutes` | List institutes (filter by city, state, searchability) |
| GET  | `/api/vendors` | List vendor profiles |

Plus the marketplace resources (`/vehicles`, `/jobs`, `/suppliers`, `/ads`, etc.) and admin/CRM/notifications/subscriptions routes.

## Tests

Run all server tests:

```bash
cd server && npm test
```

Vitest spins up an in-process MongoDB replica set for transactional tests. See `tests/setup.ts`.
