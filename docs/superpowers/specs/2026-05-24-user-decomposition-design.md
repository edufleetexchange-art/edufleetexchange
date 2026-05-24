# User Decomposition — Design Spec

**Date:** 2026-05-24
**Status:** Draft (awaiting review)
**Scope:** First architecture sub-project of the eduFleet Exchange uplift initiative.
**Repos touched:** `edufleetexchange` (server), `edufleetexchange_ui` (frontend).

---

## 1. Context & motivation

eduFleet Exchange is a three-marketplace platform for Indian K-12 institutes: a school-vehicle marketplace, a teacher job board, and a supplier directory, monetised via per-persona subscription plans plus paid ads, with built-in CRM/sales/marketing tooling.

The codebase signals "hard to change":

- `server/models/User.ts` is a god-schema mixing identity, institute fields, teacher profile, vendor fields, employee fields, and a deeply nested subscription with denormalised quota counters. Teacher fields are even duplicated (top-level `qualifications`/`subjects`/`experience` and again inside `profile.{qualification,subjects,experience}`).
- Subscription quotas live inside the User document, making increment operations race-prone (any write to User contends with quota writes) and history non-existent.
- Every other model (`Vehicle`, `Job`, `Supplier`, `Application`, `Notification`, `Ad`, `Lead`, `Task`, `Activity`, `AuditLog`, `SubscriptionRequest`) holds `ref: 'User'` foreign keys.

Project is pre-launch — no production users, no migration burden. This is the lowest-cost moment to redesign cleanly.

### Position in the broader uplift

The uplift initiative was scoped into four independent tracks: architecture, quality, UX, business growth. This spec covers the **first sub-project of the architecture track** — the User god-schema decomposition (plus Subscription separation). Other architecture sub-projects (frontend data layer dedup, server module restructure, subscription/quota event redesign) are out of scope and will get their own specs.

---

## 2. Goals & non-goals

### Goals

1. Replace the `User` god-schema with: `Account` (identity/auth) + four persona profile collections (`InstituteProfile`, `TeacherProfile`, `VendorProfile`, `StaffProfile`).
2. Pull `Subscription` out of User into its own collection, keyed by `accountId`. Keep current counter-based quotas (no usage-events redesign in this pass).
3. Update every reference in server code: auth controller, middleware, all touched controllers, route handlers. Foreign keys across `Vehicle.sellerId`, `Job.instituteId`, `Supplier.createdBy`, `Application.*`, `Notification.*`, `Ad.*`, `Lead.*`, `Task.*`, `Activity.*`, `AuditLog.*`, `SubscriptionRequest.*` switch from `ref: 'User'` to `ref: 'Account'`. API field names stay the same to minimise client churn.
4. Update the auth response and JWT to carry `{ accountId, role }`; auth middleware populates `req.account + req.profile + req.subscription` once per request.
5. Update UI types (`src/api/types.ts`, `src/types/`) and the consumers that read the old shape (notably `AuthContext` and all pages that read `user.X`).
6. Update seed scripts to produce the new shape with one canonical login per persona.
7. Establish baseline test infrastructure (Vitest + supertest + mongodb-memory-server on the server; Vitest on the UI) and cover the auth bundle, signup transactions, subscription quota atomicity, and one touched downstream controller as a smoke check.
8. Replace the placeholder one-line READMEs in both repos with real "what / why / run" documentation.

### Non-goals (explicitly out of scope; separate specs later)

- Quota/usage system redesign (events instead of counters).
- Frontend data layer / API client dedup (`src/lib/api.ts` vs `src/lib/apiClient.ts`).
- Server module restructure (the `routes/ controllers/ models/` layout stays; only a tiny new `services/` folder is added).
- `personaAccess` system rework — touched only minimally to keep it working.
- Comprehensive test coverage of all controllers — only the materially changed ones get smoke tests.
- Splitting the `Supplier` listing model from `VendorProfile` — `Supplier` stays as a marketplace listing entity, distinct from `VendorProfile` which is the account-side profile.
- Any UI redesign or new pages.
- Multi-persona accounts (one human, many roles).

### Cross-cutting decisions baked into this spec

- **One account = one persona**, locked at signup. A human who is both a teacher and an institute admin needs two separate accounts with different emails.
- **`role` lives on `Account`** and is authoritative. The service layer enforces "the profile that exists matches `role`".
- **Identity fields** (`name`, `email`, `phone`, `avatar`) live on `Account`. Persona-specific fields live on the corresponding profile.
- **Auth response** returns the populated bundle `{ account, profile, subscription }` everywhere (`/auth/signup`, `/auth/login`, `/auth/me`).
- **One active subscription per account** — partial unique index on `{ accountId, status: 'active' }`. History is preserved by leaving expired/cancelled rows in place.
- **Pre-launch redesign** — collections can be dropped and reshaped freely; no migration paths needed.

---

## 3. Data model

### `Account` (identity / auth)
```ts
{
  _id,
  name: string,
  email: string,        // unique, lowercase
  password: string,     // hashed, select:false
  role: 'institute' | 'teacher' | 'vendor' | 'admin' | 'marketing' | 'sales',
  phone?: string,
  avatar?: string,
  isActive: boolean,    // default true
  isVerified: boolean,  // default false
  createdAt, updatedAt,
}
```
Indexes: unique `{ email: 1 }`. Pre-save bcrypt hook unchanged from today. `comparePassword()` method unchanged.

`address` moves to `InstituteProfile` (only institutes have a meaningful business address). `employeeId` moves to `StaffProfile`. The `guest` role is dropped — guests aren't accounts.

### `InstituteProfile` (1:1 with Account when role='institute')
```ts
{
  _id,
  accountId,            // unique
  instituteName: string,
  contactPerson?: string,
  instituteSearchability: boolean,    // default false
  address: { street, city, state, pincode, country },
}
```

### `TeacherProfile` (1:1 with Account when role='teacher')
```ts
{
  _id,
  accountId,            // unique
  experience: number,
  qualifications: string[],
  subjects: string[],
  bio?: string,
  location?: string,
  preferredLocation?: string[],
  currentInstitute?: string,
  achievements?: string[],
  isAvailable: boolean,                // default true
}
```
Collapses the duplicated `qualifications`/`profile.qualification` and `subjects`/`profile.subjects` etc. into a single flat shape.

### `VendorProfile` (1:1 with Account when role='vendor')
```ts
{
  _id,
  accountId,            // unique
  businessName: string,
  contactPerson?: string,
  phone?: string,
  website?: string,
  address: { street, city, state, pincode, country },
}
```
Distinct from the `Supplier` model. A vendor account owns zero or more Supplier listings via `Supplier.createdBy`.

### `StaffProfile` (1:1 with Account when role ∈ {admin, marketing, sales})
```ts
{
  _id,
  accountId,            // unique
  employeeId,           // unique sparse
  department?: string,
  permissions?: string[],
}
```

### `Subscription` (separate collection)
```ts
{
  _id,
  accountId,
  planId,                                   // ref SubscriptionPlan
  status: 'active' | 'inactive' | 'suspended' | 'expired',
  paymentStatus: 'pending' | 'completed' | 'failed',
  transactionId?: string,
  startDate, endDate,
  listingsUsed, listingsLimit,
  jobPostsUsed, jobPostsLimit,
  browseCount, browseCountLimit,
  lastBrowseReset?: Date,
  notes?: string,
  createdAt, updatedAt,
}
```
Indexes: `{ accountId: 1, status: 1 }`. Partial unique on `{ accountId, status: 'active' }`. History is preserved as rows — when a sub expires, status flips to `expired` and a new doc is created for the next subscription.

### Foreign-key shifts

All identity refs across other models change `ref: 'User'` → `ref: 'Account'`. ObjectId values are the same; only the referenced collection name in Mongoose changes. API payload field names (`sellerId`, `instituteId`, `createdBy`, etc.) are unchanged to limit client-side churn.

| Model | Field(s) | Today | After |
|---|---|---|---|
| `Vehicle` | `sellerId`, `assistedBy` | `User` | `Account` |
| `Job` | `instituteId` | `User` | `Account` |
| `Supplier` | `createdBy` | `User` | `Account` |
| `Application` | applicant, job | `User`, `Job` | `Account`, `Job` |
| `Notification` | recipient | `User` | `Account` |
| `Ad` | owner/creator | `User` | `Account` |
| `Lead` | owner/assignee | `User` | `Account` |
| `Task` | owner/assignee | `User` | `Account` |
| `Activity` | actor | `User` | `Account` |
| `AuditLog` | actor | `User` | `Account` |
| `SubscriptionRequest` | requester | `User` | `Account` |

### Relationships
```
Account 1 ─── 1 InstituteProfile  (role=institute)
Account 1 ─── 1 TeacherProfile    (role=teacher)
Account 1 ─── 1 VendorProfile     (role=vendor)
Account 1 ─── 1 StaffProfile      (role ∈ {admin, marketing, sales})
Account 1 ─── * Subscription      (only one active at a time)
Account 1 ─── * Vehicle           (as seller)
Account 1 ─── * Job               (as institute)
Account 1 ─── * Supplier          (as creator)
Account 1 ─── * Application       (as applicant)
Account 1 ─── * Notification, AuditLog, Activity, …
```

### Invariant (enforced in service layer, not at DB)

An `Account` MUST have exactly the persona profile that matches its `role`. Signup is the only path that creates this pair, in a Mongoose transaction. Role changes are admin-only, rare, and out of scope beyond a `TODO` placeholder.

---

## 4. Auth & request lifecycle

### Signup endpoints (persona-specific)

Replaces the single `POST /auth/signup`:

```
POST /auth/institute/signup   → Account(role=institute) + InstituteProfile + Subscription
POST /auth/teacher/signup     → Account(role=teacher)   + TeacherProfile   + Subscription
POST /auth/vendor/signup      → Account(role=vendor)    + VendorProfile    + Subscription
```

Body shape per endpoint includes both Account fields (`name`, `email`, `password`, `phone?`, `avatar?`) and the persona-specific fields enumerated in §3. All three documents are created inside one Mongoose session — on failure, everything rolls back.

Admin / marketing / sales accounts are created via the existing admin-only path (e.g. `POST /admin/accounts`), which also creates the `StaffProfile`.

### Login

`POST /auth/login` is one endpoint for all personas. The persona-specific behaviour is *what gets populated*, not *which route is hit*.

```
find Account by email
verify password
in parallel:
  load profile matching account.role
  load active Subscription
issue JWT { accountId, role } → set cookie → return { account, profile, subscription }
```

### JWT payload

```ts
{ accountId: string, role: AccountRole, iat: number, exp: number }
```
That's it. Profile id and subscription id are not embedded — they're cheap to load fresh and embedding them creates stale-token bugs.

### Auth middleware (`requireAuth`)

On every authenticated request:
1. Verify JWT from cookie → `accountId`, `role`.
2. One aggregation (`$lookup` to the appropriate profile collection + the active subscription) returns the bundle.
3. Populate `req.account`, `req.profile`, `req.subscription`.
4. If `account.isActive === false` → 401.

Cost: one aggregation per protected request. The same as today's protected-route cost (which already loads the user); not a regression.

### Role-guard middleware

`requireRole('institute')`, `requireRole(['admin', 'marketing'])` — same shape as today. Reads `req.account.role`. No behaviour change, only naming.

### `/auth/me`

Returns `{ account, profile, subscription }` — same bundle as login.

### Things that simplify

- Subscription writes (e.g., increment `listingsUsed`) become atomic single-doc updates:
  `Subscription.findOneAndUpdate({ accountId, status: 'active' }, { $inc: { listingsUsed: 1 } })`.
  No contention with unrelated User-document writes.
- Teacher search queries `TeacherProfile` directly with `$lookup` to Account for display fields, instead of scanning Users by `role: 'teacher'` and reading sparse profile fields.

### Things to watch

- Every site that reads `user.subscription.X` today → must change to `req.subscription.X`. Grep for `user.subscription` and `.subscription.`.
- Every site that reads teacher fields off User (`user.qualifications`, `user.profile.subjects`) → must change to `req.profile.qualifications`.
- The `personaAccess` system stays as-is; it'll be wired to `req.account.role` for the persona parameter and otherwise left alone.

---

## 5. API impact

### Response-shape changes (breaking, but pre-launch — acceptable)

| Endpoint | Today | After |
|---|---|---|
| `POST /auth/signup` | one endpoint; `{ user, token }` | three endpoints (`institute|teacher|vendor`); `{ account, profile, subscription }` + cookie |
| `POST /auth/login` | `{ user, token }` | `{ account, profile, subscription }` + cookie |
| `GET /auth/me` | `{ user }` with everything nested | `{ account, profile, subscription }` |
| `GET /users/:id` | flat User doc | replaced — see resource rename below |
| `PATCH /users/me` | mixed Account+Profile fields | split into `PATCH /accounts/me` and `PATCH /profile/me` |
| `GET /subscriptions/me` | nested in `/auth/me` | dedicated endpoint returning Subscription doc |

### Resource rename

The `/users` resource is replaced by persona-specific resources and an `/accounts` resource for identity admin:

| Today | After |
|---|---|
| `GET /users` (mixed, role-filtered) | `GET /accounts` (admin only, identity-only) |
| `GET /users?role=teacher&subjects=Math` | `GET /teachers?subjects=Math` (TeacherProfile-backed) |
| `GET /users?role=institute` | `GET /institutes` |
| `GET /users?role=vendor` | `GET /vendors` |

### Field names in payloads of other resources

Fields like `sellerId`, `instituteId`, `createdBy` keep their names — only the underlying Mongoose `ref` changes. This limits API-surface churn to the auth and persona-resource endpoints.

### What the React client must update

- `AuthContext` returns `{ account, profile, subscription }` instead of `user`. Consumers grep-and-replace.
- `src/api/types.ts` and `src/types/` updated to match.
- `src/api/services/*` updated for new endpoint shapes.
- Signup pages (`Signup.tsx`, `TeacherSignup.tsx`) point at persona-specific endpoints.
- Teacher search pages point at `/teachers`.

---

## 6. Server module layout

**Constraint:** server module restructure is a non-goal. Keep `routes/ controllers/ models/ middleware/`. The only structural addition is a small `services/` folder for transactional/cross-document logic.

### Files added

```
server/models/
  Account.ts
  InstituteProfile.ts
  TeacherProfile.ts
  VendorProfile.ts
  StaffProfile.ts
  Subscription.ts

server/controllers/
  accountController.ts          (PATCH /accounts/me, admin /accounts list)
  teacherController.ts          (search/list/get from TeacherProfile)
  instituteController.ts
  vendorController.ts

server/routes/
  accounts.ts
  teachers.ts
  institutes.ts
  vendors.ts

server/services/                (NEW small folder)
  authService.ts                (signup transactions, login bundle build)
  subscriptionService.ts        (quota inc/dec, plan assignment)
```

### Files modified

```
server/index.ts                                # mount new routes
server/controllers/authController.ts           # use authService; new persona-specific signups
server/controllers/subscriptionController.ts   # use Subscription collection
server/middleware/auth.ts                      # populate req.account/profile/subscription
server/routes/auth.ts                          # add persona signups
server/controllers/{vehicle,job,supplier,ad,marketing,sales,crm,notification,admin}Controller.ts
                                               # req.user → req.account/profile/subscription
server/models/{Vehicle,Job,Supplier,Application,Ad,Lead,Task,Activity,Notification,AuditLog,SubscriptionRequest}.ts
                                               # ref: 'User' → ref: 'Account'
server/scripts/seedData/users.ts               # rewrite (see §7)
```

### Files deleted

```
server/models/User.ts
server/controllers/userController.ts
server/routes/users.ts
```

### Conventions for new code

- Mongoose schemas use the `toJSON: { virtuals: true, transform }` block already used in `SubscriptionPlan.ts` (so `_id` → `id` consistently).
- Service-layer functions are plain async functions, no class wrappers (matches existing project style).
- No new server dependencies for this section (vitest/supertest/mongodb-memory-server come in via §9).

### Blast-radius estimate

- New files: ~13 server + ~8 frontend
- Modified files: ~25 server + ~20 frontend
- Deleted files: 3 server
- Roughly 2,000–3,000 LoC across both repos, the majority mechanical.

---

## 7. Frontend impact

The non-goal forbids a data-layer refactor or API client dedup. Touch the React app only where the auth shape and types force it.

### `AuthContext`

```ts
type AuthState = {
  account: Account | null;
  profile: InstituteProfile | TeacherProfile | VendorProfile | StaffProfile | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  login: (...) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
```

Consumers grep-and-replace:

- `user.name` → `account.name`
- `user.role` → `account.role`
- `user.subscription.X` → `subscription.X`
- `user.qualifications` / `user.profile.X` → `profile.X`

### Types update

- `src/api/types.ts`: `User` → `Account`, plus four `*Profile` types, plus `Subscription`. Discriminated union `Profile` keyed on `role`.
- `src/types/` cleaned up.
- Type-narrowing helpers: `isTeacherProfile(p)`, `isInstituteProfile(p)`, `isVendorProfile(p)`, `isStaffProfile(p)`.

### API service files

- `authService.ts` — new method shapes; signup splits into `instituteSignup()`, `teacherSignup()`, `vendorSignup()`.
- `subscriptionService.ts` — `getMySubscription()`, etc.
- `userService.ts` retired in favour of `accountService.ts` + `teacherService.ts` + `instituteService.ts` + `vendorService.ts`.

### Pages touched (consumer updates only — no redesign)

`Login.tsx`, `Signup.tsx`, `TeacherSignup.tsx`, `Dashboard.tsx`, `TeacherDashboard.tsx`, `MarketingDashboard.tsx`, `SalesDashboard.tsx`, `ProtectedRoute.tsx`, `Header.tsx`, `Footer.tsx`, `SubscriptionStatus.tsx`, `SubscriptionUsageCard.tsx`, `SubscriptionAlert.tsx`, `InstituteTeacherSearch.tsx`, `TeacherSearch.tsx`, `JobListingForm.tsx`, `ListingForm.tsx`, admin pages including `admin/UserManagement.tsx`.

### Explicit non-changes

- No TanStack Query / SWR.
- No collapse of `src/lib/api.ts` vs `src/lib/apiClient.ts` — both get touched mechanically (the tax for deferring the dedup spec).
- No visual / layout changes.
- No form-library swap.

---

## 8. Seeding & dev data

### New layout

```
server/scripts/seedData/
  index.ts                # entry; runs in dependency order
  subscriptionPlans.ts    # existing or new — seeds before accounts
  accounts.ts             # creates Accounts + linked Profiles + Subscriptions in tx
  reset.ts                # truncate seedable collections (preserves plans + SystemConfig)
  vehicles.ts             # optional follow-up seed
  jobs.ts                 # optional follow-up seed
  suppliers.ts            # optional follow-up seed
```

### `accounts.ts` shape (illustrative)

```ts
const seeds = [
  { role: 'admin',     email: 'admin@edufleet.test',     name: 'Platform Admin',
    staff: { employeeId: 'EMP-001', department: 'Platform' } },
  { role: 'institute', email: 'institute1@edufleet.test', name: 'Demo School',
    institute: { instituteName: 'Demo Public School', contactPerson: 'A. Sharma',
                 address: { street: '...', city: 'Bengaluru', state: 'KA', pincode: '560001', country: 'India' } },
    plan: 'institute-free' },
  { role: 'teacher',   email: 'teacher1@edufleet.test',   name: 'R. Kumar',
    teacher:  { experience: 5, qualifications: ['M.Sc.','B.Ed.'], subjects: ['Math','Physics'], isAvailable: true },
    plan: 'teacher-free' },
  { role: 'vendor',    email: 'vendor1@edufleet.test',    name: 'Acme Books',
    vendor:   { businessName: 'Acme Books Pvt Ltd', contactPerson: 'V. Mehta', phone: '+91...' },
    plan: 'vendor-free' },
  { role: 'marketing', email: 'marketing1@edufleet.test', name: 'M. Patel',
    staff: { employeeId: 'EMP-010', department: 'Marketing' } },
  { role: 'sales',     email: 'sales1@edufleet.test',     name: 'S. Rao',
    staff: { employeeId: 'EMP-020', department: 'Sales' } },
];

// helper: Account + Profile + Subscription created in one Mongoose session
```

### NPM scripts (server)

```
"seed":           "tsx ./scripts/seedData/index.ts"
"seed:accounts":  "tsx ./scripts/seedData/accounts.ts"
"seed:reset":     "tsx ./scripts/seedData/reset.ts && npm run seed"
```

(Replaces today's lone `seed:users`.)

### Reset behaviour

Pre-launch, so `seed:reset` truncates: Accounts, all `*Profile` collections, Subscriptions, Vehicles, Jobs, Suppliers, Applications, Notifications, Ads, Leads, Tasks, Activities, AuditLogs. Plans and SystemConfig are preserved (re-seeded only if missing).

### Default credentials in `README.md`

A small table mapping seeded email → role → default password (single dev password, e.g. `password123`). Server and UI READMEs finally get real content — overview, repo layout, run instructions, link to this spec.

---

## 9. Testing strategy

Today: **zero tests** in either repo. This spec doesn't aim for comprehensive coverage but does establish the baseline and cover the touched surface.

### Server stack

- **Vitest** (native ESM, matches the project setup).
- **supertest** for HTTP-level tests against the Express app.
- **mongodb-memory-server** for an in-process MongoDB, fresh DB via `beforeEach`.

### Server tests in this spec

```
server/tests/
  auth.test.ts
    - POST /auth/institute/signup creates Account + InstituteProfile + Subscription (all 3 rows in one tx)
    - POST /auth/teacher/signup   creates Account + TeacherProfile   + Subscription
    - POST /auth/vendor/signup    creates Account + VendorProfile    + Subscription
    - duplicate email → 409, no partial writes
    - POST /auth/login returns { account, profile, subscription }; cookie set
    - GET /auth/me returns the bundle; profile matches role
    - inactive account → 401
  middleware.test.ts
    - requireAuth populates req.account / req.profile / req.subscription per role
    - requireRole rejects wrong roles
  subscription.test.ts
    - listingsUsed $inc is atomic under concurrency
    - only one active subscription per account (partial unique enforced)
  teachers.test.ts
    - GET /teachers?subjects=Math returns TeacherProfile rows with Account joined
  vehicles.test.ts (smoke for a touched controller)
    - create vehicle uses Account as sellerId; populate works
```

### Frontend tests in this spec

- **Vitest** unit tests for `AuthContext` (login → state populated correctly per persona).
- Type-narrowing helpers each get a trivial test.
- E2E (Playwright) is deferred unless the UI repo already has Playwright set up; if so, one happy-path signup per persona.

### Not tested in this spec

- Comprehensive controller coverage.
- Performance / load.
- Visual regression (UI is unchanged).

### CI

- Add `npm test` to both repos' `package.json`.
- Add `.github/workflows/test.yml` running on PRs against `main` with `node-version: 20`, `npm ci`, `npm test`.

---

## 10. Rollout (high-level — detailed steps go to writing-plans)

Pre-launch + no migration, so rollout is an ordered implementation sequence, every step green.

1. **Foundations.** Install Vitest + supertest + mongodb-memory-server in server. Add CI workflow. Write a failing test asserting the new auth bundle shape (TDD anchor).
2. **Models.** Add `Account`, four `*Profile`s, `Subscription`. Don't delete `User.ts` yet.
3. **Services.** Implement `authService.signup{Institute,Teacher,Vendor}`, `authService.login`, `authService.me`, `subscriptionService.incrementUsage`. Unit/integration tests on each.
4. **Auth controller + middleware rewrite.** `requireAuth` populates `req.account/profile/subscription`. Auth tests pass.
5. **Mechanical ref rename.** Across other models, `ref: 'User'` → `ref: 'Account'`. Compile, tests still green.
6. **Controller updates.** Go controller-by-controller, fix read sites (`req.user.X` → `req.account.X` / `req.profile.X` / `req.subscription.X`): vehicle, job, supplier, ad, marketing, sales, crm, notification, admin, subscription. Each gets a smoke test.
7. **New persona resources.** Add `/teachers`, `/institutes`, `/vendors`, `/accounts` routes/controllers. Move `/users` consumers over.
8. **Delete old.** `User.ts`, `userController.ts`, `routes/users.ts`. Compile must stay green.
9. **Seeds.** Rewrite `seedData/` per §8. Verify `npm run seed` produces working logins for all six personas.
10. **Frontend.** Update types, `AuthContext`, signup/login pages, then mechanical pass through all consumers. Frontend tests pass.
11. **READMEs.** Replace placeholders with real "what / why / run" docs in both repos. Link this spec.
12. **Smoke pass.** Manually log in as each persona, browse, create listing, post job, apply, subscribe. Capture any missed read-sites and fix in-spec.

Each numbered step is a small commit / PR, building incrementally.

---

## 11. Open questions / future work

- **Role conversion** — admin-only API to change an Account's role (e.g., a teacher account becomes a vendor account). Currently out of scope; placeholder TODO.
- **Multi-persona accounts** — explicit non-goal here. If the product later wants this, the model already supports it (1:N profiles per account) and the change is additive.
- **Quota event sourcing** — current spec keeps counter fields on `Subscription`. A follow-up spec should replace them with append-only usage events, with the counters becoming derived/cached values.
- **Frontend data layer dedup** — `src/lib/api.ts` and `src/lib/apiClient.ts` both get touched mechanically here; collapsing them is a separate spec.
- **Server module restructure** — feature-folder layout is a separate spec.
- **`personaAccess` system** — works today and is left alone; a future spec should reconcile it with `Account.role` and `req.profile`.
- **Splitting `Supplier` and `VendorProfile`** — both kept distinct here. A future spec may revisit when supplier-listing logic matures.
