# User Decomposition — Resume Handoff

**Last updated:** 2026-05-24
**Branch:** `feat/user-decomposition` on both `edufleetexchange/` and `edufleetexchange_ui/`
**Plan:** [`docs/superpowers/plans/2026-05-24-user-decomposition.md`](./2026-05-24-user-decomposition.md)
**Spec:** [`docs/superpowers/specs/2026-05-24-user-decomposition-design.md`](../specs/2026-05-24-user-decomposition-design.md)

## Status: 10 of 23 tasks complete

| Task | Status | Commit | Notes |
|---|---|---|---|
| 1. Test stack + anchor | ✅ done | `78f4c13` + `75d533d` | vitest + supertest + mongodb-memory-server installed |
| 2. CI workflow | ✅ done | `c2fb7ad` | `.github/workflows/test.yml` at server git root |
| 3. Account model | ✅ done | `8b5696b` | bcrypt + uniqueness + lowercase email |
| 4. Profile models (×4) | ✅ done | `217cfbb` | Institute/Teacher/Vendor/Staff, 1:1 with Account |
| 5. Subscription model | ✅ done | `d6b5277` + `f9d14e7` | active-uniqueness partial unique index; idempotent registration applied to all 6 models (and SubscriptionPlan during Task 6) for Vitest test isolation |
| 6. authService | ✅ done | `1aca3f9` + `3b60046` | Transactional persona signups + login + loadBundle. Fix-up: isActive before bcrypt, encodeURIComponent on avatar URL |
| 7. subscriptionService | ✅ done | `1ea7727` | Atomic `$inc` on usage counters; canConsume |
| 8. Middleware rewrite | ✅ done | `47c9c05` | `req.account/profile/subscription`. Old exports removed (`authorize`, `protect`, `restrictTo`, `requireAdmin`, `optionalAuth`). **Other controllers will not compile until Task 11.** |
| 9. Auth controller + routes | ✅ done | `47ba404` | Persona-specific signups, bundle response. Old `/auth/me PUT`, `/auth/profile *` removed |
| 10. ref User→Account rename | ✅ done | `e5802fb` | 11 models touched: Vehicle, Job, Supplier, Application, Notification, Lead, Task, Activity, AuditLog, SubscriptionRequest, SystemConfig |

Test state: **36/36 passing.**

## Known-broken right now (gets fixed in Task 11)

Every server file that imports the old middleware exports or reads `req.user.X` will fail TypeScript compilation. Specifically:

- `middleware/personaAccessControl.ts` references `req.userId` (old AuthRequest shape) — needs updating to `req.account?.id`.
- All controllers (`vehicleController`, `jobController`, `supplierController`, `adController`, `marketingController`, `salesController`, `crmController`, `notificationController`, `adminController`, `subscriptionController`, `personaAccessController`) read `req.user.X` — need updating to `req.account/profile/subscription.X` per the substitution table in Task 11 of the plan.
- The legacy `controllers/userController.ts` will be deleted in Task 15 — until then it still imports `models/User.js`, which still exists. Leave it alone for now; it'll just be deleted.
- Likely some routes (e.g., `routes/auth.ts` reference removed — already replaced; verify no stragglers in other route files).
- The server **will not boot** in this state. Tests pass because no test exercises the broken controllers.

## How to verify what landed (quick sanity check)

```bash
cd /Users/automicai/Documents/GitHub/eduFleet/edufleetexchange
git checkout feat/user-decomposition
git log --oneline main..HEAD          # should show 13 commits since branching
cd server && npm install && npm test  # 36/36 should pass
```

## Resuming in a fresh conversation

Open a new Claude Code session in `/Users/automicai/Documents/GitHub/eduFleet/` and say something like:

> "I'm resuming the user-decomposition refactor. The spec is at `edufleetexchange/docs/superpowers/specs/2026-05-24-user-decomposition-design.md`, the plan is at `edufleetexchange/docs/superpowers/plans/2026-05-24-user-decomposition.md`, and the resume notes are at `edufleetexchange/docs/superpowers/plans/2026-05-24-user-decomposition-RESUME.md`. We're on `feat/user-decomposition`, 10 of 23 tasks done, Task 11 is next. Continue with subagent-driven execution."

Claude should:
1. Read the resume note (this file).
2. Confirm branch state and tests-pass baseline.
3. Resume `subagent-driven-development` skill from Task 11.

## Remaining tasks at a glance

| # | Title | Type | Notes |
|---|---|---|---|
| 11 | Update all controllers (10 files) | Mechanical-heavy | Biggest single batch. `req.user.X` → `req.account/profile/subscription.X` per substitution table in plan. Touch `personaAccessControl.ts` too. |
| 12 | accountController + routes | Small | PATCH /accounts/me + admin list |
| 13 | teacherController + routes | Small | GET /teachers list + detail |
| 14 | instituteController + vendorController + routes | Small | Mirrors Task 13 |
| 15 | Delete legacy User files | Mechanical | rm User.ts, userController.ts, routes/users.ts; unmount from index.ts |
| 16 | Rewrite seedData | Mechanical | accounts.ts seeds 6 personas through authService |
| 17 | UI types | Mechanical | Replace User interface with Account/Profile union/Subscription in `src/api/types.ts` |
| 18 | UI authService + subscriptionService | Mechanical | Repoint at new endpoints, return bundle |
| 19 | Rewrite AuthContext | Substantive | Centerpiece — exposes account/profile/subscription |
| 20 | UI Vitest setup + AuthContext tests | Substantive | Establishes UI test infra |
| 21 | Migrate UI consumers | Mechanical-heavy | Bulk find-and-replace `useAuth().user` → `useAuth().account/profile/subscription` across ~25 files |
| 22 | Real READMEs | Mechanical | Replace placeholders in both repos |
| 23 | Manual smoke pass | Human | Run both servers, exercise all 6 personas |

## Deviations from the original plan (for transparency)

1. **Idempotent model registration** — every model file (Account, 4 Profiles, Subscription, SubscriptionPlan) uses `(mongoose.models.X as Model<I>) ?? mongoose.model<I>('X', schema)` so Vitest's per-file module reset doesn't trigger `OverwriteModelError`. The plan didn't specify this; it was added during execution.
2. **`login` order** — `isActive` is checked BEFORE `comparePassword` (security fix added during code-quality review on Task 6).
3. **Avatar URL** — uses `encodeURIComponent(email)` (defensive fix added during code-quality review on Task 6).
4. **Test rename** — "rolls back all 3 documents on duplicate email" was renamed to "rejects duplicate email and leaves the original account intact" (the original name overpromised — the unique-email constraint fires before any rollback is exercised).
5. **CI workflow path** — `.github/workflows/test.yml` lives at the server git root (`edufleetexchange/`), with `working-directory: server` and `cache-dependency-path: server/package-lock.json` because `package.json` is inside `server/`.

None of these changes are spec-breaking; they're all defensive or hygiene improvements.

## Test counts by file (state at handoff)

```
tests/anchor.test.ts                       1 test
tests/middleware/auth.test.ts              4 tests
tests/models/account.test.ts               4 tests
tests/models/profiles.test.ts              6 tests
tests/models/subscription.test.ts          4 tests
tests/services/authService.test.ts         8 tests
tests/services/subscriptionService.test.ts 4 tests
tests/integration/auth.test.ts             5 tests
---------------------------------------------------
Total                                     36 tests, 0 failures
```
