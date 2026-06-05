# Job Consultant Persona — Design Spec

**Date:** 2026-06-04
**Status:** Draft (awaiting review)
**Scope:** New persona on top of the existing Account + Profile + Subscription decomposition.
**Repos touched:** `edufleetexchange` (server), `edufleetexchange_ui` (frontend).

---

## 1. Context & motivation

eduFleet Exchange today has three external personas:
- **Institute** — posts jobs, searches teachers, buys vehicles, sources suppliers
- **Teacher** — browses jobs, applies, manages own profile
- **Vendor** — lists supplier services

In the Indian K-12 teacher hiring market, a fourth distinct actor mediates many placements: the **Job Consultant** (also called education recruiter / placement consultant / staffing partner). Real-world workflow:

1. Schools call or email consultants describing roles they need filled.
2. Consultants maintain a roster of teachers they represent.
3. Consultants pre-screen candidates, then propose them to schools.
4. Consultants coordinate interviews between school and teacher.
5. On successful placement, consultants typically earn commission (1 month's salary is industry standard).

Currently this workflow is handled outside the platform — consultants log into institute or teacher accounts on behalf of others (compliance smell), or work entirely off-platform via WhatsApp/email. This leaves money on the table: consultants who would happily pay for a workspace tailored to their pipeline cannot use the platform in its current shape.

### Position in the broader product

This adds a **fourth external persona** alongside Institute, Teacher, Vendor — and reuses much of the existing infrastructure (matchService, Application, Notification, Subscription). The spec is intentionally a single, focused sub-project of similar size to the original User-decomposition refactor.

---

## 2. Goals & non-goals

### Goals

1. **New `consultant` role** added to `Account.role` enum with a matching `ConsultantProfile` model — 1:1 with Account, parallel to Institute/Teacher/Vendor/Staff profiles. Self-signup path at `POST /api/auth/consultant/signup`.
2. **Roster management:** consultants can save teachers as "represented" and institutes as "client schools." Roster is private to the consultant (other consultants cannot see who you represent).
3. **Job board access:** consultants see the same public Jobs index institutes see, plus filters tuned to broker work (active jobs only, recently posted, subject + location + salary range).
4. **Teacher discovery:** consultants can search the existing TeacherProfile collection using the same `/api/teachers` endpoint institutes already use. Same quota model applies.
5. **Proposed matches:** consultants can use `matchService` (skill-match scoring, already shipped in R2) to compute teacher↔job match scores and curate a list of "best matches" for any given job.
6. **Submit applications on behalf of teachers** (with explicit consent recorded). Existing `Application` model gets an optional `submittedByConsultantId` field to track the broker source. Applications surface in the institute's existing applications view labeled with the consultant's name.
7. **Interview lifecycle as a first-class entity:**
   - A new `Interview` model captures one or more interview rounds per application.
   - Consultant (or institute) schedules interview: date/time, mode (in-person / video / phone), location/link, notes.
   - Both the teacher AND institute receive Notifications.
   - Interview can be rescheduled, completed, canceled, or marked no-show.
   - Outcome (recommended hire / hold / reject) plus consultant's internal notes.
8. **Placement pipeline:** consultant dashboard surfaces a kanban of all active placements with stages: `proposed → applied → interviewing → offer_extended → placed | declined | lost`. Each card shows job, teacher, current stage, last activity, next action.
9. **Consultant Subscription:** new `planType: 'consultant'` for SubscriptionPlan with quota dimensions tuned to the role (`rosterTeacherLimit`, `monthlyApplicationsLimit`, `monthlyPlacementLimit`). Reuses the existing Subscription model — no schema change to Subscription itself, only adding new optional fields to `SubscriptionPlan.features`.
10. **Audit trail:** every consultant-initiated action (proposed a teacher, submitted an application, scheduled an interview, marked a placement) writes to the existing `AuditLog` model.

### Non-goals (explicitly out of scope; separate specs later)

- **Commission/payment tracking** — money flow between consultant ↔ institute ↔ teacher is complex (TDS, invoicing, partial payments) and warrants its own spec. v1 just lets consultants mark a placement as "placed" with optional `agreedFee` numeric field; no invoicing, no payment status, no GST.
- **Multi-consultant collaboration** — agencies with multiple consultants sharing rosters are a real use case but a clear v2 scope.
- **Consultant ↔ vendor flows** — vendors don't intersect with placement workflows; no integration with Supplier model.
- **Bidirectional matchmaking marketplace** — consultants do NOT see "open RFPs from institutes wanting consultants"; institutes today post jobs publicly, consultants react. We're not adding a new "institute requests a consultant" surface.
- **Background check integration** — the deferred T4 (Authbridge/Karza/SpringVerify) item would naturally extend to teachers represented by consultants; out of scope here.
- **Consultant-facing search of OTHER consultants** — no consultant directory, no consultant↔consultant referrals.

### Cross-cutting decisions baked in

- **Role is locked at signup** (matches existing one-account-one-persona rule). A consultant cannot also be a teacher; if they want to apply for jobs personally, they need a separate teacher account.
- **Consent for submitted-on-behalf applications:** a consultant submitting an application on behalf of a teacher requires `teacher.consultantConsent.granted === true` (a new opt-in flag on TeacherProfile). Without consent, the consultant can only mark a teacher as "represented" — they cannot apply for them.
- **Teacher controls roster visibility:** a teacher can revoke consultant representation at any time via TeacherDashboard; this immediately removes them from the consultant's roster and cancels any pending consultant-submitted applications still in `proposed` stage.
- **Institute sees the consultant:** when reviewing an application, the institute sees "via consultant: <Consultant Name>" next to the teacher info. Transparency, not hidden brokering.
- **Notification routing:** any interview state change notifies all three parties — teacher, institute contact, consultant.
- **Subscription gating:** unverified consultants (no active subscription) can browse jobs and view teachers in their roster, but cannot submit applications, schedule interviews, or mark placements.

---

## 3. Data model

### `Account` — extend role enum

```ts
role: 'institute' | 'teacher' | 'vendor' | 'admin' | 'marketing' | 'sales' | 'consultant'
```

Add `'consultant'` to the enum. No other changes to `Account`.

### `ConsultantProfile` (new, 1:1 with Account when role='consultant')

```ts
{
  _id,
  accountId,                  // unique, ref: Account
  agencyName?: string,        // optional; some consultants are individuals
  registrationNumber?: string, // RTC / industry license; optional
  yearsOfExperience: number,
  specializations: {
    subjects: string[],       // e.g. ['Math', 'Physics']
    levels: string[],         // e.g. ['Primary', 'Middle', 'Secondary']
    regions: string[],        // e.g. ['Bengaluru', 'Mysore']
  },
  bio?: string,
  website?: string,
  phone?: string,             // mirrored from Account but stored on profile for direct lookup
  address?: { street?, city, state, pincode, country },
  verification?: {            // reuse the R3a VerificationRequest flow
    status: 'none' | 'pending' | 'verified' | 'rejected',
    verifiedAt?: Date,
    verifiedBy?: ObjectId,
  },
  createdAt, updatedAt,
}
```

Indexes:
- `{ accountId: 1 }` unique
- `{ 'specializations.subjects': 1 }`
- `{ 'specializations.regions': 1 }`

### `ConsultantRoster` (new — represents the consultant's teachers + client institutes)

```ts
{
  _id,
  consultantAccountId,        // ref: Account
  entityType: 'teacher' | 'institute',
  entityAccountId,            // ref: Account (teacher or institute)
  status: 'active' | 'archived' | 'inactive',
  addedAt: Date,
  archivedAt?: Date,
  internalNotes?: string,     // private to the consultant
  tags?: string[],            // free-form, e.g. 'priority', 'remote-ok'
  createdAt, updatedAt,
}
```

Indexes:
- `{ consultantAccountId: 1, entityType: 1, status: 1 }`
- Partial-unique on `{ consultantAccountId, entityAccountId }` where `status: 'active'` (prevents adding the same person twice while active).

### `TeacherProfile` — extend with `consultantConsent`

```ts
consultantConsent: {
  granted: boolean,        // default false
  grantedAt?: Date,
  revokedAt?: Date,
  scope: 'any' | 'specific',  // 'specific' restricts to certain consultants
  allowedConsultantAccountIds?: ObjectId[],   // populated when scope='specific'
}
```

When granted, ANY active consultant who has this teacher in their roster can submit applications on the teacher's behalf. When `scope='specific'`, only the listed consultants can.

### `Application` — extend with `submittedByConsultantId`

```ts
submittedByConsultantId?: ObjectId,   // ref: Account (consultant)
```

When set, this application was submitted by a consultant on behalf of the teacher. The teacher remains the applicant of record (`teacherId` unchanged), but the institute sees attribution.

### `Interview` (new — promoted from inline application state)

Currently the existing `Application` model has fields like `interviewDate`, `interviewScheduledAt` baked in. With multi-round interviews this won't scale. New entity:

```ts
{
  _id,
  applicationId,             // ref: Application
  jobId,                     // denormalized for query
  teacherAccountId,          // denormalized
  instituteAccountId,        // denormalized
  scheduledByAccountId,      // who scheduled (consultant or institute)
  round: number,             // 1, 2, 3 — for multi-round
  mode: 'in_person' | 'video' | 'phone',
  scheduledAt: Date,
  durationMinutes: number,
  location?: string,         // physical address if mode=in_person
  meetingLink?: string,      // for mode=video
  participants: ObjectId[],  // accountIds — typically [teacher, institute_contact]; consultant added if attending
  status: 'scheduled' | 'rescheduled' | 'completed' | 'canceled' | 'no_show',
  rescheduleReason?: string,
  notesBefore?: string,      // pre-interview notes (private to scheduler)
  outcome?: 'recommend_hire' | 'hold' | 'reject',
  notesAfter?: string,       // post-interview notes
  consultantId?: ObjectId,   // ref: Account (if mediated)
  createdAt, updatedAt,
}
```

Indexes:
- `{ teacherAccountId: 1, status: 1, scheduledAt: -1 }`
- `{ instituteAccountId: 1, status: 1, scheduledAt: -1 }`
- `{ consultantId: 1, status: 1 }`
- `{ applicationId: 1, round: 1 }`

### `Placement` (new — the consultant's pipeline entity)

```ts
{
  _id,
  consultantAccountId,
  teacherAccountId,
  jobId,
  applicationId?: ObjectId,   // null until consultant submits an application
  stage: 'proposed' | 'applied' | 'interviewing' | 'offer_extended' | 'placed' | 'declined' | 'lost',
  agreedFee?: number,         // optional placement fee in INR (no payment tracking in v1)
  agreedFeeNotes?: string,
  stageHistory: [
    {
      stage: string,
      changedAt: Date,
      changedByAccountId: ObjectId,
      reason?: string,
    }
  ],
  lastActivityAt: Date,
  internalNotes?: string,
  createdAt, updatedAt,
}
```

Indexes:
- `{ consultantAccountId: 1, stage: 1, lastActivityAt: -1 }`
- `{ teacherAccountId: 1, stage: 1 }`
- `{ jobId: 1 }`
- Partial-unique on `{ consultantAccountId, teacherAccountId, jobId }` where `stage` is in `['proposed', 'applied', 'interviewing', 'offer_extended']` (prevents duplicate active pipelines for the same triplet).

### `SubscriptionPlan` — extend `features` with consultant fields

Add to the existing `features` sub-document:

```ts
maxRosterTeachers?: number,        // null/0 = unlimited
maxRosterInstitutes?: number,
maxApplicationsPerMonth?: number,
maxPlacementsPerMonth?: number,
canViewTeacherContact?: boolean,   // gating PII access
```

And the `planType` enum gains `'consultant'`. No change to `Subscription` itself — quota counters can be reused (`listingsUsed/Limit` repurposed if needed) OR new counters added later as part of the deferred quota-event refactor.

### Relationships at a glance

```
Account(consultant) 1 ─── 1 ConsultantProfile
Account(consultant) 1 ─── * ConsultantRoster ─── 1 Account(teacher or institute)
Account(consultant) 1 ─── * Placement ─── 1 Job
                                      └── 1 Account(teacher)
                                      └── 0..1 Application
Placement * ─── 0..* Interview (linked via applicationId)
Application 0..1 submittedByConsultantId ──> Account(consultant)
TeacherProfile.consultantConsent ──> controls whether consultants can apply on teacher's behalf
```

---

## 4. Auth & request lifecycle

### Signup

New endpoint: `POST /api/auth/consultant/signup`. Body:

```ts
{
  name, email, password, phone,
  agencyName?: string,
  yearsOfExperience: number,
  specializations: { subjects: string[], levels: string[], regions: string[] },
  bio?: string,
}
```

Mirrors the existing `signupInstitute/Teacher/Vendor` shape. `authService.signupConsultant` opens a Mongoose transaction: creates Account + ConsultantProfile + Subscription (assigned the free consultant plan). Returns the standard `{ account, profile, subscription }` bundle.

Admin can also create consultants via `authService.adminCreateConsultant` — same pattern as the R3a `adminCreate*` family.

### Auth middleware

No change. `req.account.role === 'consultant'` is the role check. `req.profile` is the `ConsultantProfile`. `requireRole('consultant')` gates consultant-only endpoints.

### Permissions matrix

| Action | Consultant | Institute | Teacher | Admin |
|---|---|---|---|---|
| Browse public job board | ✓ | ✓ | ✓ | ✓ |
| Search TeacherProfile | ✓ (subject to quota) | ✓ (subject to quota) | ✗ | ✓ |
| Add teacher to own roster | ✓ | ✗ | ✗ | ✗ |
| Apply on behalf of teacher | ✓ (consent required) | ✗ | ✗ (self only) | ✗ |
| Schedule interview | ✓ (only for own pipelines) | ✓ (own jobs only) | ✗ | ✓ |
| Mark placement stage | ✓ (own pipelines only) | ✗ | ✗ | ✓ |
| See another consultant's roster | ✗ | ✗ | ✗ | ✓ |
| See teacher's `consultantConsent` settings | ✓ (only `granted` flag) | ✗ | ✓ (own) | ✓ |

---

## 5. API endpoints

New routes under `/api/consultants` (consultant-self), `/api/roster`, `/api/placements`, `/api/interviews`.

### Auth
- `POST /api/auth/consultant/signup` — create consultant Account + profile + subscription
- (existing `/auth/login`, `/auth/me` already work)

### Profile
- `GET  /api/consultants/me` — own profile + subscription bundle
- `PATCH /api/consultants/me` — update profile fields (specializations, bio, phone, address)
- `GET  /api/consultants/:id` — public read of another consultant's profile (used for institute "via consultant" badge)

### Roster
- `GET  /api/roster?entityType=teacher&status=active&page=&pageSize=` — paginated own roster
- `POST /api/roster` — add `{entityType, entityAccountId}` to roster
- `PATCH /api/roster/:id` — update notes/tags/status
- `DELETE /api/roster/:id` — remove

### Discovery
- `GET /api/jobs/recommended-for-consultant?subject=&region=&limit=20` — jobs scored against the consultant's roster (highest match score across any rostered teacher wins). Reuses `matchService.scoreJobForTeacher`.
- `GET /api/teachers/recommended-for-job/:jobId?limit=20` — for a given job, returns top teachers in the consultant's roster ranked by match score.

### Applications (extension)
- `POST /api/applications` — extended to accept `{teacherAccountId, jobId, coverLetter?}`. When called by consultant role:
  - Server verifies `teacher.consultantConsent.granted === true` (and consultant is in `allowedConsultantAccountIds` if scope='specific')
  - Server verifies the consultant has the teacher in their `active` roster
  - Stamps `submittedByConsultantId: req.account.id`
  - Creates a Placement if one doesn't exist for `(consultant, teacher, job)`, advancing the stage to `applied`
- `GET /api/applications/by-consultant?status=&page=&pageSize=` — consultant's submitted applications

### Interviews
- `GET  /api/interviews?role=mine&status=scheduled&from=&to=` — consultant sees interviews they scheduled OR are participants in
- `POST /api/interviews` — body: `{applicationId, scheduledAt, durationMinutes, mode, location?, meetingLink?, participants[], notesBefore?}`. Server fires Notifications to all participants.
- `PATCH /api/interviews/:id` — reschedule (status='rescheduled', new scheduledAt), or complete (with outcome+notesAfter), or cancel
- `GET /api/interviews/:id` — single interview detail

### Placements
- `GET  /api/placements?stage=&page=&pageSize=` — paginated, consultant's own
- `POST /api/placements` — create a placement at stage='proposed' for `{teacherAccountId, jobId}`. No application yet — just the consultant's internal tracking.
- `PATCH /api/placements/:id` — transition stage. Stage transitions are validated against allowed paths (e.g., can't skip from 'proposed' directly to 'placed'). Each transition appends a `stageHistory` row.
- `DELETE /api/placements/:id` — archive (soft delete via stage='lost' with reason)
- `GET  /api/placements/:id/timeline` — combined timeline of stage changes + interviews + notes

### Teacher consent management
- `PATCH /api/teachers/me/consultant-consent` — teacher updates their own consent. Body: `{granted, scope?, allowedConsultantAccountIds?}`.

### Admin
- `GET  /api/admin/placements?consultantId=&stage=` — admin view of all placements
- `GET  /api/admin/consultants?status=` — list with subscription + verification status

All standard response envelope: `{ success, data, message?, timestamp }`.

---

## 6. UI surfaces

### New pages (in `src/pages/`)

- `ConsultantSignup.tsx` — `/consultant/signup` (parallel to TeacherSignup / VendorSignup)
- `ConsultantDashboard.tsx` — `/consultant/dashboard` — landing dashboard
  - Stats row: active roster size (teachers + institutes), open pipelines, interviews this week, placements this month
  - "Recommended jobs for your roster" row (top 6, links to job detail)
  - Pipeline kanban (proposed → applied → interviewing → offer → placed / declined / lost) — drag-and-drop OR dropdown per card to transition stage
  - Upcoming interviews calendar (next 7 days)
- `ConsultantRoster.tsx` — `/consultant/roster` — tabbed Teachers / Institutes
  - Search bar across roster
  - Add new (opens dialog with TeacherProfile / InstituteProfile search)
  - Per-row: name, last activity, internal notes preview, tags
- `ConsultantInterviews.tsx` — `/consultant/interviews` — list + calendar toggle
- `ConsultantPlacements.tsx` — `/consultant/placements` — full pipeline list/kanban
- `ConsultantJobSearch.tsx` — `/consultant/jobs` — reskinned JobBrowse with consultant-specific filters and "Propose to roster" button on each card
- `ConsultantTeacherSearch.tsx` — `/consultant/teachers` — reskinned InstituteTeacherSearch with "Add to roster" / "Propose for job" actions

### New components (in `src/components/`)

- `PlacementCard.tsx` — kanban card showing teacher + job + stage + actions
- `InterviewScheduler.tsx` — dialog with date/time, mode, location/link, participant selector, notes
- `AddToRosterDialog.tsx` — search and confirm
- `ConsultantBadge.tsx` — display "via [Consultant Name]" on institute's application views
- `ProposeMatchesDialog.tsx` — for a job, show top-N roster teachers ranked by match score, multi-select to create proposed placements

### Modifications to existing surfaces

- **InstituteJobApplications.tsx** — show `<ConsultantBadge>` next to teacher name when `application.submittedByConsultantId` is set; clicking opens a small popover with consultant name, agency, and contact
- **TeacherDashboard.tsx** — add a "Consultants representing you" section in profile area:
  - List of consultants with active roster entries pointing at this teacher
  - Master toggle: "Allow consultants to apply for jobs on my behalf" (writes to `consultantConsent.granted`)
  - Per-consultant revoke button
- **App.tsx** — register all new consultant routes inside a `<ProtectedRoute requiredRole="consultant">` wrapper. Pattern matches existing institute/teacher route blocks.
- **Header.tsx** — when `account.role === 'consultant'`, show consultant nav links (Dashboard, Roster, Jobs, Teachers, Pipeline, Interviews) — parallel to existing role-conditional nav
- **AuthContext.tsx** — add `signupConsultant(input)` method (mirrors existing `signupInstitute/Teacher/Vendor`)
- **types/profileGuards.ts** — add `isConsultantProfile(p, role)` type guard
- **PricingSection.tsx** — show consultant-tier plans alongside institute/teacher/vendor

### New API service files

- `src/api/services/consultantService.ts` — profile + roster + placement + interview methods

### No changes (explicit)

- VehicleCard, SupplierCard, NotificationBell, all R1/R2/R3a admin moderation pages — consultant surface does not touch these.

---

## 7. Cross-persona implications

### What the **Institute** sees that's new

- When viewing applications for one of their jobs: a small consultant badge next to teacher name + tooltip with consultant agency and contact info
- No new permissions; no new UI other than that badge
- A consultant can never see the institute's private application notes or internal status

### What the **Teacher** sees that's new

- "Consultants representing you" widget on TeacherDashboard
- Master toggle for consultant consent + per-consultant revoke
- An "Applied by [Consultant Name]" label on applications they didn't personally submit (so teacher always knows their application history)
- They can REVOKE a consultant from representing them at any time

### What the **Admin** sees that's new

- New `/admin/consultants` queue (parallel to vendor admin views)
- `/admin/placements` cross-consultant view for moderation/dispute resolution
- Consultant accounts subject to the same VerificationRequest flow as institutes/vendors (the R3a KYC pipeline)
- Audit log surface gains consultant-initiated events

### What the **Vendor / Marketing / Sales / Guest** sees

- Nothing changes. Consultants are invisible to these roles.

---

## 8. Notification matrix

| Event | Teacher gets | Institute gets | Consultant gets |
|---|---|---|---|
| Consultant adds teacher to roster | ✓ (informational, no action) | — | — |
| Teacher revokes consent | — | — | ✓ |
| Consultant submits application on teacher's behalf | ✓ (confirmation + link) | ✓ (new application) | ✓ |
| Application stage change | ✓ | ✓ | ✓ |
| Interview scheduled / rescheduled / canceled | ✓ | ✓ | ✓ |
| Interview outcome marked | — | — | ✓ |
| Placement marked `placed` / `declined` / `lost` | ✓ | ✓ | ✓ |
| Consultant's subscription expiring | — | — | ✓ |

All notifications reuse the existing `Notification` model; just add new `type` enum values: `consultant_added_to_roster`, `consultant_consent_revoked`, `placement_stage_changed`, `interview_invitation`, `placement_completed`.

---

## 9. Rollout plan / phases

Pre-launch, no real users, so we can ship in clean phases — every phase should produce running, testable software.

### Phase 1 — Foundation (server)
1. Add `consultant` to Account role enum
2. Create `ConsultantProfile` model (idempotent registration pattern)
3. Add `consultantConsent` sub-doc to TeacherProfile
4. Extend `Application` with `submittedByConsultantId`
5. Tests for the new field and new model

### Phase 2 — Auth (server)
6. `authService.signupConsultant` (transactional)
7. `authService.adminCreateConsultant`
8. `POST /api/auth/consultant/signup` route
9. New consultant-free subscription plan in seedData
10. Update `seedData/accounts.ts` to seed `consultant1@edufleet.test`
11. Tests for signup + login bundle shape

### Phase 3 — Roster + consent (server)
12. `ConsultantRoster` model
13. Roster CRUD endpoints
14. Teacher consent PATCH endpoint
15. Tests

### Phase 4 — Applications + Placements (server)
16. Extend `POST /api/applications` to accept `teacherAccountId` from consultants
17. Server-side consent check + roster check
18. `Placement` model + endpoints
19. Stage-transition validation
20. Tests

### Phase 5 — Interviews (server)
21. `Interview` model
22. Interview endpoints (create, reschedule, complete, cancel)
23. Notification fan-out on schedule/reschedule/cancel
24. Tests

### Phase 6 — Recommendations (server)
25. New endpoints `/jobs/recommended-for-consultant` and `/teachers/recommended-for-job/:jobId` — both reuse the existing `matchService`
26. Tests

### Phase 7 — UI types + services
27. `src/api/types.ts` — new `Consultant`, `ConsultantRoster`, `Placement`, `Interview` types; extend `AccountRole`
28. `src/types/profileGuards.ts` — `isConsultantProfile`
29. `src/api/services/consultantService.ts`
30. Extend `AuthContext.signupConsultant`

### Phase 8 — UI consultant routes
31. `ConsultantSignup.tsx` + route
32. `ConsultantDashboard.tsx` + route
33. `ConsultantRoster.tsx` + route
34. `ConsultantJobSearch.tsx` + route
35. `ConsultantTeacherSearch.tsx` + route
36. `ConsultantPlacements.tsx` + route
37. `ConsultantInterviews.tsx` + route
38. `Header.tsx` consultant nav block
39. Mobile responsiveness pass for new pages (the audit patterns from the mobile sweep apply)

### Phase 9 — UI cross-persona touches
40. `InstituteJobApplications.tsx` — consultant badge on applications
41. `TeacherDashboard.tsx` — "Consultants representing you" widget + consent toggle
42. `App.tsx` route registration
43. `PricingSection.tsx` — consultant plans

### Phase 10 — Admin
44. `/admin/consultants` page
45. `/admin/placements` page
46. Verification flow extended to consultants (R3a infrastructure reused)

### Phase 11 — Tests + smoke
47. Server: full integration test suite for Placement + Interview + consent paths
48. UI: Vitest for new components; Playwright golden-path for consultant signup → add to roster → schedule interview → mark placement
49. Visual smoke spec extended with `consultant-dashboard` surface

---

## 10. Open questions / future work

- **Commission flow** — agreedFee is stored as a number with no payment tracking. Future spec: invoicing + GST + TDS handling for placement fees.
- **Multi-consultant agencies** — currently one `Account` = one consultant. A consulting firm with 5 recruiters needs separate accounts today. Future: `Organization` entity owning multiple consultant accounts with shared roster.
- **Consultant ratings** — extending the R2 Reviews feature so institutes can review consultants they've worked with. Likely a v2.
- **Teacher representation marketplace** — should teachers be able to publish "looking for consultant representation" status? Reverse of the current consultant-initiated flow. Skipped in v1.
- **Background check integration** — R3b T4 (Authbridge/Karza) would naturally extend to consultant-represented teachers; treated as an orthogonal concern.
- **Bulk operations** — proposing 50 teachers to 50 jobs at once. Useful for high-volume consultants. Out of v1.
- **Calendar integration** — Google Calendar / Outlook for interview scheduling. v2.
- **WhatsApp Business API integration** for notifications — Indian consultants live on WhatsApp. v2.
- **Pipeline analytics** — conversion rate by stage, time-to-placement, drop-off analysis. v2 once enough data exists.
- **In-app messaging** — consultant ↔ teacher and consultant ↔ institute chat threads. v2; current Notification model only supports one-way alerts.

---

## Sizing notes

This is roughly the same complexity as the original User-decomposition refactor:
- ~5 new server models (ConsultantProfile, ConsultantRoster, Interview, Placement, plus extensions)
- ~12 new endpoints + 2 extensions to existing
- ~7 new UI pages + 4 modifications to existing
- ~5 new components
- 1 new persona surface + cross-persona implications in 3 existing personas

Roughly 4–6 implementation sessions if approached the same way as the original refactor — server first, UI second, glue + tests last. If split into a server PR + UI PR pair per phase, ~12–18 PRs total.

The plan ([writing-plans] follow-up) would decompose this into ~30 bite-sized tasks.
