# Mobile Responsiveness Audit — 2026-06-01

**Approach:** 4 parallel static reviewers, no UI rendering, citations to file:line.
**Branch state at audit time:** all of session work merged to local `main` (refactor + R1 + R2 + R3a).

## Cross-cutting themes (the real story — many findings are instances of these patterns)

### CRITICAL patterns

1. **AdminSidebar is always-visible at `w-64`** — no mobile collapse. On a 360 px phone it consumes 256 px, leaving 104 px for content. **Every admin/sales/marketing route is broken on phones.** (`src/components/AdminSidebar.tsx:182`)

2. **Hardcoded popover `w-96` on `NotificationBell`** — overflows every phone screen by 24 px+; right-side action buttons clipped. (`src/components/NotificationBell.tsx:43`)

3. **`<Table>` containers without `overflow-x-auto` wrappers** — across 5 admin/internal pages:
   - `MarketingDashboard.tsx` leads + audit tables
   - `SalesDashboard.tsx` leads + subscription pipeline tables
   - `ReportModeration.tsx` (7 columns)
   - `VerificationModeration.tsx` (6 columns)
   - `AuditLogManagement.tsx` (5 columns)
   These force horizontal scroll of the entire page on mobile.

4. **`DialogContent` without `w-[95vw]` fallback** — at least 8 dialogs:
   - Apply-to-Job (JobDetails / TeacherJobDetails — both use `max-w-2xl`)
   - Schedule Interview (InstituteJobApplications)
   - VerifyAccountDialog (`max-w-md`)
   - ReportButton (default `max-w-lg`)
   - UserDetailDialog
   - ReportModeration / VerificationModeration detail dialogs
   - Subscription request dialog
   Most don't actually overflow because Radix caps at viewport, but explicit `w-[95vw]` is safer and prevents Safari edge-cases.

5. **Outer `p-8` on dashboard/admin pages** — consumes 64 px of 360 px viewport horizontally. Affects `MarketingDashboard`, `SalesDashboard`, `ReportModeration`, `VerificationModeration`, `AuditLogManagement`.

6. **Hover-only interactions still present after audit-fix passes:**
   - `VehicleCard.tsx:80–94` — share + report buttons inside `opacity-0 group-hover:opacity-100` overlay
   - `ListingForm.tsx:474` — image remove button hover-gated, so users can't remove uploaded photos on mobile
   - (Previously-fixed) `InstituteTeacherSearch` overlay confirmed working

7. **Fixed-pixel card dimensions inside auto-fill grids:**
   - `JobCard.tsx:91` — `w-[192px] h-[192px]` inside `grid-cols-[repeat(auto-fill,minmax(192px,1fr))]` leaves dead gutter on phone

8. **`LeadCRMDialog` hard 50/50 split panels** — `w-1/2 border-r` + `w-1/2` columns at all breakpoints. On a 360 px phone each panel is 180 px — completely unusable for a CRM form.

9. **`Dashboard.tsx` stat-card grid `grid-cols-2 md:grid-cols-4 lg:grid-cols-7`** — 7 cards in 2 cols on phone crushes `text-3xl` numbers with `p-6` padding. Should start at `grid-cols-1`.

10. **`TeacherDashboard.tsx` `<TabsList>`** — shadcn TabsList has no horizontal scroll. 4 triggers at default sizing clip on 360 px phones.

11. **`Landing.tsx` hero `text-5xl` base** with no smaller mobile variant — at 320 px, 48 px text wraps to 3–4 chars/line, eating huge viewport height.

12. **`Landing.tsx` quick-links `grid-cols-4` with `w-16 h-16` (64 px) tiles** — at 320 px the column is 60 px, icons overflow.

### IMPORTANT patterns

13. **Filter sidebars stack above results on 4 browse pages** (Browse, JobBrowse, SupplierBrowse, InstituteTeacherSearch) — users scroll past 300–400 px of filter controls before seeing any results. No `<Sheet>` drawer pattern.

14. **Section header `flex justify-between` rows** force squish on phones — Landing hero CTA rows × 3, Dashboard section headers (My Listings, My Job Openings), Marketing/Sales header CTA rows. All need `flex-col sm:flex-row`.

15. **Dialog form `grid grid-cols-2` without `sm:` breakpoint** in multiple dialogs (Generate Lead, Close Deal, Onboard Entity, Schedule Interview). Two 130 px columns on phone don't fit Select/Date inputs.

16. **Tap targets below 44 px** (Apple floor): ReportButton trigger (28 px), NotificationsPage delete button (32 px), ListingForm image remove (16 px checkbox), WriteReviewDialog star picker (36 px), JobListingForm array remove buttons (32 px), several others.

17. **`text-3xl` headings without mobile variant** — at 360 px width many dashboard titles render at 30 px causing 2–3 line wraps.

18. **PricingSection tabs `px-8 h-12 text-base`** for 3 triggers — total width 330–360 px, no overflow scroll on TabsList, clips at 320 px.

## Tally by surface

| Surface | Critical | Important | Minor |
|---|---|---|---|
| Landing + Auth + Header/Footer | 2 | 10 | 9 |
| Dashboards (Inst/Teach/Mkt/Sales) | 10 | 9 | 7 |
| Browse + Search + Cards | 2 | 5 | 4 |
| Detail pages | 4 | 6 | 5 |
| Dialogs (Verify/Review/Report/CRM/etc) | 4 | 11 | 8 |
| Admin moderation pages | 3 | 5 | 3 |

## Recommended fix batches (in priority order)

### Batch 1 — Cross-cutting infrastructure (HIGHEST leverage; one fix → many surfaces)
- AdminSidebar mobile collapse (hamburger + Sheet drawer)
- Standardize `<TableWrapper>` component with `overflow-x-auto` and replace 5 admin tables
- Patch shadcn `<DialogContent>` to default to `w-[95vw] sm:max-w-lg` (one change, fixes 8 dialogs)
- NotificationBell popover responsive width
- `p-8` → `p-4 sm:p-8` sweep on admin/dashboard outer padding

### Batch 2 — Cards (touched on every browse page)
- VehicleCard: always-visible share/report (no hover gate)
- JobCard: `w-full h-full` instead of fixed 192×192
- ListingForm: image remove always-visible on mobile

### Batch 3 — Public/Landing (first impressions for new users)
- Landing hero text scaling (`text-3xl sm:text-5xl md:text-6xl lg:text-8xl`)
- Landing quick-links grid + tile sizes
- PricingSection tabs overflow + scale-105 mobile fix
- Section header flex-col on mobile (×3 sections)

### Batch 4 — Dashboards
- Dashboard stat-card grid (`grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7`)
- Header CTA rows flex-col on mobile (Dashboard, Marketing, Sales)
- TeacherDashboard TabsList overflow-x-auto wrapper
- MarketingDashboard / SalesDashboard outer padding (`p-4 sm:p-8`)

### Batch 5 — Dialogs (after the shadcn primitive patch)
- LeadCRMDialog flex-col on mobile (50/50 split → stacked)
- Apply dialogs (JobDetails / TeacherJobDetails) `max-h-[90dvh] overflow-y-auto`
- Dialog form `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` sweep

### Batch 6 — Browse filter sidebars
- Convert filter aside on Browse, JobBrowse, SupplierBrowse, InstituteTeacherSearch to a `<Sheet>` drawer triggered by a "Filters" button on mobile

### Batch 7 — Tap target sweep
- All sub-44px buttons (~6 sites across forms/dialogs)
