# eduFleet Exchange — Product Requirements Document (v2, fresh)
Status: DRAFT for founder verification · 2026-07-05
Greenfield specification — assumes nothing is built. This document alone
defines the new project.

## 1. What this product is
**A direct-contact platform for Indian schools.** Schools find teachers, sell
what they no longer need, and discover trusted suppliers — and every deal
happens **directly between the two parties**. The platform never sits in the
middle: no brokered payments, no commissions, no recruiter middlemen.

One sentence per user:
- **A school** posts a job in minutes and hires the teacher directly.
- **A teacher** builds one profile and gets discovered — or applies — directly.
- **A supplier** gets a public storefront page schools can find and contact.

## 2. Users & their jobs-to-be-done

### 2.1 School (institute) — the center of the platform
1. **Hire teachers**: post job openings (subject, experience, salary); browse
   and search teacher profiles; contact, interview and hire directly.
2. **Sell what the school owns**: list its own vehicles (buses, vans) and its
   own used items (furniture, lab equipment, etc.) for sale. Strict rule:
   **only schools sell vehicles/items — third-party dealers are never allowed.**
3. **Buy with confidence**: browse suppliers for books, uniforms, ties, badges,
   tables, furniture; contact the supplier directly.
4. **Stay informed**: demand alerts — "tell us the subject you need; we notify
   you the moment a matching teacher registers."

### 2.2 Teacher
1. Create a profile (subjects, qualifications, experience, location,
   availability) that schools can discover.
2. Browse openings in and around schools; apply directly with one form.
3. Be contacted, interviewed and hired — directly by the school.

### 2.3 Supplier (public word; internal role name "vendor")
1. Create an account and a **public profile page** — a simple storefront:
   who they are, what they sell (books, uniforms, badges, furniture…),
   photos, contact details.
2. Appear in the supplier directory once **approved by admin** (anti-spam gate).
3. Receive direct enquiries from schools. No transactions on-platform.

### 2.4 Admin (platform owner)
1. Approve/reject supplier profiles and school listings (quality gate) —
   submitters always see a clear **"Pending admin approval"** state.
2. Manage users, plans, reports; receive demand-lead notifications.

## 3. Core flows (MVP)
| # | Flow | Acceptance |
|---|---|---|
| F1 | School signs up → posts job | ≤3 minutes on a phone, minimal required fields |
| F2 | Teacher signs up → applies | profile once, apply in one step |
| F3 | School browses teachers → contacts | search by subject/location; direct contact |
| F4 | School lists vehicle or used item | photos, price, condition; admin-approved; buyer contacts school directly |
| F5 | Supplier signs up → storefront live | signup creates the profile; visible pending state; public after approval |
| F6 | Demand alert → notification | email + in-app the moment a match registers |

## 4. Experience principles (the rebuild's contract)
1. **Phone-first.** Most users arrive from WhatsApp on a phone. Every flow
   must be excellent at 390px before desktop is considered.
2. **Browse open, act gated.** Anyone can read listings, titles, prices,
   salaries. Signing up is required only to apply/contact/post.
3. **Nothing silent.** Every state the user is in — pending approval, quota
   reached, empty marketplace — says so plainly and offers the next step.
4. **One design language** across public pages, dashboards and admin; calm,
   trustworthy, fast. (Direction to be chosen WITH the founder from options —
   not assumed.)
5. **Honest copy.** No invented stats or inflated claims anywhere.
6. **India-wide and generic.** City-specific campaigns live in marketing
   materials, never hard-coded in the product.

## 5. Non-goals
- ❌ Third-party vehicle/item dealers (only schools sell their own).
- ❌ Job consultants / recruiter-middleman flows of any kind.
- ❌ On-platform payments, escrow, or commissions.
- ❌ Anything that puts the platform between two parties who could talk directly.

## 6. Monetization (unchanged principle, later phase)
Free at launch. Future: subscription tiers for volume/priority features
(more listings, priority placement, instant alerts) — never per-transaction fees.

## 7. Delivery plan (greenfield)
- **Phase 1 (MVP)**: F1–F3 + F5 — the school↔teacher hiring loop plus supplier
  storefronts. Launchable on its own.
- **Phase 2**: F4 (vehicles + used items) and F6 (demand alerts).
- **Phase 3**: subscriptions/monetization (§6).
- Each flow ships only when E2E-tested (signup→outcome) on phone and desktop;
  test-first (TDD) for every role boundary (e.g. supplier can never list a
  vehicle; nothing public before admin approval).

## 8. Success metrics (MVP)
- A school goes from landing → posted job in under 3 minutes on a phone.
- A teacher goes from landing → applied in under 5 minutes.
- First 10 real schools and 50 real teachers onboarded; first hire made
  through direct contact.

## 9. Open questions for the founder
- Q1: Used-items listings in Phase 2 scope — confirmed?
- Q2: Admin approval for school job posts too, or only listings/suppliers?
- Q3: Design direction — I present 2–3 visual mockups for you to choose from
  before any UI is built. Agreed?
- Q4: Tech stack preference for the new project, or my recommendation?
