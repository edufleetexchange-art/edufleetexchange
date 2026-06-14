# Feature Spec — Demand Alerts ("Notify me when X is available")

**Date:** 2026-06-14
**Status:** Draft for build
**Depends on / serves:** [Go-To-Market: teacher-hiring wedge](2026-06-14-go-to-market-teacher-hiring-wedge.md)

---

## 1. What the user asked for

> "Subscribe and notification — I need a maths teacher, and as soon as one is available I should get a notification. If I need a bus, as a subscriber to a 40-seater bus I should get notified. And also kind of custom notifications."

A buyer **subscribes to a need** (a saved search). When matching **supply appears**, they get **notified** (in-app / email / WhatsApp). Works for teachers, vehicles, and arbitrary custom criteria.

> ⚠️ This is the term "subscription" overloaded. This feature is **Alerts** (saved-search notifications). It is NOT the billing `Subscription` model. Keep them separate in code — new model is `Alert`.

---

## 2. Why this is worth building now (and most features aren't)

This is the **one** build that accelerates the go-to-market instead of delaying it:

- **It captures demand intent.** A "wanted: maths teacher, Bengaluru, 3+ yrs" alert is a qualified lead that tells you precisely what supply to go recruit. You've had zero demand signal for a year; this manufactures it.
- **It re-engages.** Marketplaces are empty early. Alerts let a school leave a standing request and come back when there's a reason to — instead of seeing an empty list once and never returning.
- **The first notification goes to YOU.** Every teacher alert also pings the founder/admin: *"Demo School wants a maths teacher — go source one."* The school's alert IS your sales pipeline. You fulfill it by hand (per the GTM concierge playbook), then the school gets matched and trusts the platform.

**Scope discipline:** build the **teacher slice first**. Design the schema to generalize to vehicles/custom, but do not wire those until the teacher version has a real user (you). A bus alert with zero bus listings notifies nobody.

---

## 3. Data model

### `Alert` (new collection)
| Field | Type | Notes |
|---|---|---|
| `accountId` | ObjectId → Account | Who wants to be notified (the buyer) |
| `createdByRole` | string | So we know if a staff/consultant set it on a school's behalf |
| `entityType` | enum `teacher` \| `vehicle` \| `job` \| `supplier` \| `custom` | What kind of supply |
| `label` | string | Human name, e.g. "Maths teacher – Secondary – Bengaluru" |
| `criteria` | mixed (typed per entityType) | The matchable filter (see below) |
| `channels` | string[] `in_app` \| `email` \| `whatsapp` | Where to send |
| `status` | enum `active` \| `paused` \| `expired` | |
| `expiresAt` | Date? | Auto-expire stale alerts so they don't spam forever (default 60 days) |
| `lastMatchedAt` | Date? | |
| `matchCount` | number | |

**`criteria` shape per entityType:**
- **teacher:** `{ subjects: string[], levels: string[], location?: string, minExperience?: number, maxExpectedSalary?: number }`
- **vehicle:** `{ vehicleType?: string, minCapacity?: number, maxPrice?: number, location?: string }` (40-seater = `minCapacity: 40`)
- **custom:** `{ keywords: string[], freeText?: string }` — matched against title/description/tags of any new listing

### `AlertMatch` (new collection — dedupe + audit)
| Field | Type | Notes |
|---|---|---|
| `alertId` | ObjectId → Alert | |
| `entityType` / `entityId` | string / ObjectId | The supply that matched (e.g. the teacher) |
| `notifiedAt` | Date | |
| Unique index | `{ alertId, entityId }` | **Prevents re-notifying** the same alert about the same teacher twice |

---

## 4. How matching fires (event-driven fan-out)

When new supply becomes available, run the matcher against active alerts. Trigger points:
- **Teacher** becomes available: on `signupTeacher`, and on `TeacherProfile` update where `isAvailable` flips to true (or subjects/location change).
- **Vehicle**: on listing **approved** (status → approved), not on create (pending listings shouldn't fire alerts).
- **Custom**: on any new approved listing of the relevant type.

```
on supplyBecameAvailable(entity):
  alerts = Alert.find({ entityType, status: 'active' })            // candidate alerts
  for alert in alerts:
     if matches(alert.criteria, entity)                            // reuse matchService scoring
        and not AlertMatch.exists({ alertId, entityId: entity.id }):  // not already sent
            createAlertMatch(...)                                   // record (dedupe)
            notify(alert.accountId, alert.channels, entity)        # the buyer
            notifyFounder(alert, entity)                           # ← the GTM concierge ping
            alert.matchCount++ ; alert.lastMatchedAt = now
```

- **`matches()`** reuses the existing `matchService` (it already does skill/criteria scoring for recommendations). Add a threshold (e.g. score ≥ 0.6) so near-misses don't spam.
- Run the fan-out **async after the entity is saved** (don't block the signup/approval response). A simple `void alertService.fanOut(entity).catch(log)` is fine at this scale; move to a queue only when volume demands.

---

## 5. Notification channels

Reuse the existing `Notification` model for **in-app** (add types: `alert_teacher_available`, `alert_vehicle_available`, `alert_custom_match`). Then:
- **In-app** — ✅ ship first (infra exists; the bell + NotificationsPage already render it).
- **Email** — ✅ ship second (nodemailer already wired for password reset).
- **WhatsApp** — 🔜 highest-value for Indian schools but needs an external provider (WhatsApp Cloud API / Gupshup / Twilio). Spec it, ship it once the manual playbook proves schools want the pings. Until then, the **founder ping** can simply be a WhatsApp message you send yourself.

---

## 6. MVP scope (teacher wedge only) — what to actually build now

1. **`Alert` + `AlertMatch` models** (generic schema, teacher matching wired only).
2. **Create-alert flow** — an institute (or you, on their behalf) creates a teacher alert from the teacher-search page: subjects, level, location, min experience. One screen, <60s.
3. **My Alerts list** — view / pause / delete active alerts.
4. **Fan-out on teacher availability** — when a matching teacher joins or turns available:
   - in-app Notification to the institute,
   - **and a Notification (+ your WhatsApp/email) to the founder/admin** = the lead to go place a teacher.
5. **Dedupe** via `AlertMatch` so a school isn't pinged twice for the same teacher.
6. **Channels:** in-app now; email fast-follow.

**Explicitly NOT in MVP:** vehicle alerts, custom-keyword alerts, WhatsApp API integration, digesting/batching. Schema supports them; wiring waits.

---

## 7. API surface (leverages existing patterns)

```
POST   /api/alerts                 create (auth; institute/admin/consultant)
GET    /api/alerts/mine            list caller's alerts
PATCH  /api/alerts/:id             pause / resume / edit
DELETE /api/alerts/:id             remove
```
Fan-out is internal (`services/alertService.ts`), called from `authService.signupTeacher`, teacher update, and vehicle-approve paths. Envelope + auth/role gating follow existing conventions.

## 8. UI surface
- **"🔔 Alert me when available"** button on `ConsultantTeacherSearch` / `InstituteTeacherSearch` (and later `Browse` for vehicles) → opens a small dialog pre-filled from the current filters.
- **"My Alerts"** tab on the institute & consultant dashboards (reuse `EmptyState`, `StatusBadge`).
- Matches surface in the existing notifications bell/page (no new notification UI needed).

---

## 9. Non-goals (v1)
- WhatsApp API delivery (manual founder send first).
- Price-drop / re-availability alerts, saved-search analytics.
- Per-alert frequency/digest controls.
- Vehicle & custom alerts (schema-ready, unwired).

---

## 10. The honest caveat

This feature only produces value once **real supply flows through the system** — i.e. once you're actually recruiting teachers per the GTM playbook. Build the MVP, then **the act of working the playbook (adding teachers) is what makes alerts fire.** Don't build the bus/custom versions until a school has received, and reacted to, a single teacher alert. One working loop beats three half-built ones.

---

### Recommended build order
1. `Alert` + `AlertMatch` models + `alertService.fanOut` (teacher only) + founder ping.
2. Create/list/pause API + the two UI surfaces.
3. Email channel.
4. (Later) vehicle matching → custom keywords → WhatsApp API.
