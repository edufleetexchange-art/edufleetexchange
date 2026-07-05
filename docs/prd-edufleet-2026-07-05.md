# eduFleet Exchange — PRD + Technical Design (TDD)
Status: DRAFT for founder verification · 2026-07-05

## 1. Product principle (founder's rule)
A **direct-contact platform for Indian schools** — no middlemen, no transactions
brokered by us. We connect the parties; they deal directly.

## 2. Roles & permissions (the strict model)

### School (institute) — the center of the platform
| May do | Status today |
|---|---|
| Post job openings (free) | ✅ live, verified |
| Browse/search teachers, contact & hire directly | ✅ live (login-gated PII) |
| Post its OWN vehicles for sale (no third-party dealers ever) | ✅ live, enforced |
| Post used items for sale (furniture, equipment, etc.) | ❌ NOT BUILT — decision D2 |
| Create demand alerts ("notify me when a Maths teacher registers") | ✅ live, email+in-app |

### Teacher
| May do | Status today |
|---|---|
| Create profile; be visible/available to schools for interview | ✅ live |
| Browse openings in/around schools; apply directly | ✅ live, verified |

### Vendor (= supplier of goods: books, uniforms, ties, badges, tables, furniture…)
| May do | Status today |
|---|---|
| Create account + public profile listing what he sells | 🟡 signup auto-creates supplier listing (pending admin approval) — shipped 2026-07-05 |
| Appear on /suppliers once approved; schools contact directly | ✅ live |
| See "Pending admin approval" state + manage own listings | ❌ UI not built yet (server ready) — in flight |
| Sell/list vehicles | 🚫 forbidden by design — enforced (403) |
| Dedicated public profile PAGE per vendor | ❌ partial (card+dialog only) — decision D3 |

### Admin (platform owner)
| May do | Status today |
|---|---|
| Approve/reject supplier listings (anti-spam gate) | ✅ live + notified on new submissions |
| Approve vehicles, manage users/plans/reports | ✅ live |

## 3. Open product decisions (founder to answer)
- **D1 — Job Consultant persona**: recruiter-middleman suite (signup/dashboard/roster/
  placements/interviews) exists but CONTRADICTS the direct-contact rule.
  Options: (a) remove entirely, (b) hide signup, keep code dormant. **PENDING**
- **D2 — Used-items listings for schools**: new listing type (name, category,
  photos, price, condition; same approval + direct-contact pattern as vehicles).
  Build now / later / never? **PENDING**
- **D3 — Vendor public profile page**: dedicated route (e.g. /supplier/:id) with
  items list, vs. today's card+dialog. Build? **PENDING**
- **D4 — Silent subscription upgrade on supplier approval**
  (supplierController approve path): keep or remove? **PENDING**
- **D5 — Dead `/api/vendors` directory endpoint** (exposes vendor contact data,
  unused by UI): remove? **PENDING (recommend remove)**

## 4. Technical design (current architecture)
- **Deploys**: all-Vercel, project-per-env (dev/stage/prod), git-push CD from
  branches; details in docs/ci-cd.md + docs/deploy-git-setup.md.
- **Data**: MongoDB Atlas per-env DBs; images in Vercel Blob (per-env prefixes);
  email via Resend (domain verification pending → then real emails).
- **Auth**: JWT (body token + Bearer header; cookie fallback same-origin).
- **Design system**: "Meridian Exchange" (src/lib/meridian.ts + mx-* utilities);
  public pages shipped; dashboards batch in verification; admin batch queued.
- **Key models**: Account(role) + per-role Profile + Subscription; Job;
  Vehicle (institute-owned); Supplier (listing, createdBy=vendor account,
  status pending→approved); Alert/AlertMatch (demand alerts).

## 5. Work in flight (agreed, not yet shipped)
1. Vendor dashboard UI: "My Listings" tab + create-listing form + persistent
   amber "Pending admin approval — not yet publicly visible" banner.
2. Terminology unification: user-facing word is **"Supplier"** everywhere
   (vendor stays as the internal role name).
3. Meridian dashboards batch (13 pages + 5 components, verification running),
   then admin batch.

## 6. Test strategy (TDD)
- **Unit/integration (server, vitest + in-memory Mongo, CI-gated)**: every role
  boundary above gets an explicit test — vendor CANNOT create vehicle/job (403);
  institute CANNOT create supplier listing on behalf of others; fresh vendor
  signup ⇒ pending Supplier exists; approval ⇒ vendor notified; pending listing
  invisible to public list. (Some exist; add the missing boundary tests with the
  vendor-UI work.)
- **E2E journeys (Playwright, per release)**: guest browse→signup gates;
  school signup→post job→receive application; teacher signup→apply;
  vendor signup→see pending banner→admin approves→listing public.
- **Content-freeze verification** for design work: AST text-identity diff
  (scratchpad/extract_text.mjs pattern) — no copy changes in restyles.
- **Envelope contract**: all new endpoints return `{success, data, code?}`.

## 7. Non-goals (per founder rule)
- No third-party vehicle dealers. No brokered payments/transactions.
- No recruiter-middleman flows (pending D1). No multi-city GTM copy in product
  UI (platform is generic India-wide; GTM materials live in docs/gtm/).
