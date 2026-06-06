# Job Consultant Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth external persona — Job Consultant — that brokers placements between Institutes and Teachers, with full roster, application-on-behalf, multi-round interview, and pipeline tracking surfaces.

**Architecture:** New `consultant` role on the existing `Account` enum + 1:1 `ConsultantProfile`. Three new domain models (`ConsultantRoster`, `Interview`, `Placement`) plus extensions to `Application`, `TeacherProfile`, and `SubscriptionPlan`. Reuses the existing transactional signup pattern, `matchService` scoring, `Notification` model, and R3a verification flow. Server-first phases (1–6), then UI (7–9), then admin (10), then tests/smoke (11).

**Tech Stack:** TypeScript, Express, Mongoose (transactions), Vitest + supertest + mongodb-memory-server for server tests. React + Vite + shadcn/ui + Tailwind for UI. Playwright for E2E. Spec lives at `docs/superpowers/specs/2026-06-04-job-consultant-persona-design.md`.

---

## File Structure (locked decomposition)

### Server — new files
- `server/models/ConsultantProfile.ts` — 1:1 profile, mirrors VendorProfile shape
- `server/models/ConsultantRoster.ts` — consultant's saved teachers + institutes
- `server/models/Interview.ts` — first-class multi-round interview entity
- `server/models/Placement.ts` — consultant's pipeline entity
- `server/routes/consultants.ts` — self + public consultant routes
- `server/routes/roster.ts` — roster CRUD
- `server/routes/interviews.ts` — interview lifecycle
- `server/routes/placements.ts` — placement pipeline
- `server/controllers/consultantController.ts`
- `server/controllers/rosterController.ts`
- `server/controllers/interviewController.ts`
- `server/controllers/placementController.ts`
- `server/services/placementService.ts` — stage-transition validation, history
- `server/services/interviewService.ts` — schedule/reschedule + notification fan-out
- `server/tests/integration/consultant-signup.test.ts`
- `server/tests/integration/consultant-roster.test.ts`
- `server/tests/integration/consultant-applications.test.ts`
- `server/tests/integration/consultant-interviews.test.ts`
- `server/tests/integration/consultant-placements.test.ts`
- `server/tests/integration/consultant-recommendations.test.ts`
- `server/tests/integration/teacher-consent.test.ts`

### Server — modified files
- `server/models/Account.ts` — extend role enum
- `server/models/TeacherProfile.ts` — add `consultantConsent` sub-doc
- `server/models/Application.ts` — add `submittedByConsultantId`
- `server/models/SubscriptionPlan.ts` — extend `planType` enum + new feature fields
- `server/services/authService.ts` — add `signupConsultant`, `adminCreateConsultant`, extend `PROFILE_MODEL_BY_ROLE`
- `server/controllers/authController.ts` — add `signupConsultant` handler
- `server/routes/auth.ts` — add consultant signup route
- `server/controllers/teacherController.ts` (or `teachers.ts` route) — add consent PATCH
- `server/controllers/applicationController.ts` — accept consultant submissions
- `server/scripts/seedData/accounts.ts` — seed consultant1@edufleet.test
- `server/index.ts` — register new routes

### UI — new files
- `src/api/services/consultantService.ts`
- `src/api/services/rosterService.ts`
- `src/api/services/interviewService.ts`
- `src/api/services/placementService.ts`
- `src/pages/ConsultantSignup.tsx`
- `src/pages/ConsultantDashboard.tsx`
- `src/pages/ConsultantRoster.tsx`
- `src/pages/ConsultantJobSearch.tsx`
- `src/pages/ConsultantTeacherSearch.tsx`
- `src/pages/ConsultantPlacements.tsx`
- `src/pages/ConsultantInterviews.tsx`
- `src/pages/admin/ConsultantManagement.tsx`
- `src/pages/admin/PlacementManagement.tsx`
- `src/components/PlacementCard.tsx`
- `src/components/InterviewScheduler.tsx`
- `src/components/AddToRosterDialog.tsx`
- `src/components/ProposeMatchesDialog.tsx`
- `src/components/ConsultantBadge.tsx`
- `src/components/TeacherConsentToggle.tsx`
- `tests/e2e/consultant-flow.spec.ts`

### UI — modified files
- `src/api/types.ts` — add Consultant, ConsultantRoster, Interview, Placement types + extend AccountRole
- `src/types/profileGuards.ts` — add `isConsultantProfile`
- `src/context/AuthContext.tsx` — add `signupConsultant`
- `src/api/services/authService.ts` — add `signupConsultant`
- `src/App.tsx` — register consultant routes + new admin routes
- `src/components/Header.tsx` — consultant nav block
- `src/components/PricingSection.tsx` — surface consultant plans
- `src/pages/TeacherDashboard.tsx` — add "Consultants representing you" widget
- `src/pages/InstituteJobApplications.tsx` — add ConsultantBadge to consultant-submitted applications
- `tests/e2e/visual-smoke.spec.ts` — add consultant-dashboard surface

---

# Phase 1 — Foundation models (server)

### Task 1: Extend `Account.role` enum with `consultant`

**Files:**
- Modify: `server/models/Account.ts:4`
- Modify: `server/models/Account.ts:39`
- Test: `server/tests/integration/consultant-signup.test.ts` (created in Task 8)

- [ ] **Step 1: Edit role enum type**

In `server/models/Account.ts`, change line 4:

```ts
export type AccountRole = 'institute' | 'teacher' | 'vendor' | 'admin' | 'marketing' | 'sales' | 'consultant';
```

- [ ] **Step 2: Edit Mongoose role enum**

In the same file, change line 39 (inside `accountSchema`) to:

```ts
role: {
  type: String,
  enum: ['institute', 'teacher', 'vendor', 'admin', 'marketing', 'sales', 'consultant'],
  required: true,
},
```

- [ ] **Step 3: Commit**

```bash
git add server/models/Account.ts
git commit -m "feat(account): add consultant role to enum"
```

---

### Task 2: Create `ConsultantProfile` model

**Files:**
- Create: `server/models/ConsultantProfile.ts`

- [ ] **Step 1: Write the model**

Create `server/models/ConsultantProfile.ts`:

```ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IConsultantProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  agencyName?: string;
  registrationNumber?: string;
  yearsOfExperience: number;
  specializations: {
    subjects: string[];
    levels: string[];
    regions: string[];
  };
  bio?: string;
  website?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  verification?: {
    status: 'none' | 'pending' | 'verified' | 'rejected';
    verifiedAt?: Date;
    verifiedBy?: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IConsultantProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    agencyName: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },
    yearsOfExperience: { type: Number, default: 0, min: 0 },
    specializations: {
      subjects: { type: [String], default: [] },
      levels: { type: [String], default: [] },
      regions: { type: [String], default: [] },
    },
    bio: { type: String, trim: true },
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    verification: {
      status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
      verifiedAt: Date,
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ 'specializations.subjects': 1 });
schema.index({ 'specializations.regions': 1 });

export default (mongoose.models.ConsultantProfile as mongoose.Model<IConsultantProfile>) ?? mongoose.model<IConsultantProfile>('ConsultantProfile', schema);
```

- [ ] **Step 2: Commit**

```bash
git add server/models/ConsultantProfile.ts
git commit -m "feat(model): ConsultantProfile schema with specializations and verification"
```

---

### Task 3: Add `consultantConsent` sub-doc to TeacherProfile

**Files:**
- Modify: `server/models/TeacherProfile.ts`

- [ ] **Step 1: Add interface field**

In `server/models/TeacherProfile.ts`, extend `ITeacherProfile` (after `isAvailable`, before `createdAt`):

```ts
consultantConsent?: {
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  scope: 'any' | 'specific';
  allowedConsultantAccountIds?: mongoose.Types.ObjectId[];
};
```

- [ ] **Step 2: Add schema field**

In the same file, inside the `new Schema<ITeacherProfile>(...)` definition, add after `isAvailable: { type: Boolean, default: true },`:

```ts
consultantConsent: {
  granted: { type: Boolean, default: false },
  grantedAt: Date,
  revokedAt: Date,
  scope: { type: String, enum: ['any', 'specific'], default: 'any' },
  allowedConsultantAccountIds: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
},
```

- [ ] **Step 3: Commit**

```bash
git add server/models/TeacherProfile.ts
git commit -m "feat(teacher): add consultantConsent sub-doc for broker opt-in"
```

---

### Task 4: Extend `Application` with `submittedByConsultantId`

**Files:**
- Modify: `server/models/Application.ts`

- [ ] **Step 1: Add interface field**

In `server/models/Application.ts`, add to `IApplication` interface after `acceptedAt?: Date;`:

```ts
submittedByConsultantId?: mongoose.Types.ObjectId;
```

- [ ] **Step 2: Add schema field**

In the same file, add inside `applicationSchema` definition after `acceptedAt: Date,`:

```ts
submittedByConsultantId: {
  type: Schema.Types.ObjectId,
  ref: 'Account',
},
```

- [ ] **Step 3: Add index**

After existing indexes at the bottom of the file (before `export default`):

```ts
applicationSchema.index({ submittedByConsultantId: 1 });
```

- [ ] **Step 4: Commit**

```bash
git add server/models/Application.ts
git commit -m "feat(application): track consultant who submitted on behalf of teacher"
```

---

### Task 5: Extend `SubscriptionPlan` for consultant tier

**Files:**
- Modify: `server/models/SubscriptionPlan.ts`

- [ ] **Step 1: Extend interface**

In `server/models/SubscriptionPlan.ts`, inside `IPersonaFeatures` interface, add after `instantJobNotifications?: boolean;`:

```ts
// Consultant-specific features
maxRosterTeachers?: number;
maxRosterInstitutes?: number;
maxApplicationsPerMonth?: number;
maxPlacementsPerMonth?: number;
canViewTeacherContact?: boolean;
```

- [ ] **Step 2: Extend `planType` interface union**

In the same file, find the `ISubscriptionPlan` interface and change:

```ts
planType: 'teacher' | 'institute' | 'vendor' | 'consultant';
```

- [ ] **Step 3: Extend Mongoose `planType` enum**

In the same file, find the `planType` schema field and update its enum:

```ts
planType: {
  type: String,
  enum: ['teacher', 'institute', 'vendor', 'consultant'],
  required: true,
},
```

- [ ] **Step 4: Add new feature schema fields**

In the same file, inside `features:` schema (after `instantJobNotifications`):

```ts
maxRosterTeachers: { type: Number, min: 0 },
maxRosterInstitutes: { type: Number, min: 0 },
maxApplicationsPerMonth: { type: Number, min: 0 },
maxPlacementsPerMonth: { type: Number, min: 0 },
canViewTeacherContact: { type: Boolean, default: false },
```

- [ ] **Step 5: Commit**

```bash
git add server/models/SubscriptionPlan.ts
git commit -m "feat(subscription): add consultant planType + quota fields"
```

---

### Task 6: Create `ConsultantRoster` model

**Files:**
- Create: `server/models/ConsultantRoster.ts`

- [ ] **Step 1: Write the model**

```ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IConsultantRoster extends Document {
  consultantAccountId: mongoose.Types.ObjectId;
  entityType: 'teacher' | 'institute';
  entityAccountId: mongoose.Types.ObjectId;
  status: 'active' | 'archived' | 'inactive';
  addedAt: Date;
  archivedAt?: Date;
  internalNotes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IConsultantRoster>(
  {
    consultantAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    entityType: { type: String, enum: ['teacher', 'institute'], required: true },
    entityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    status: { type: String, enum: ['active', 'archived', 'inactive'], default: 'active' },
    addedAt: { type: Date, default: Date.now },
    archivedAt: Date,
    internalNotes: { type: String, trim: true },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ consultantAccountId: 1, entityType: 1, status: 1 });
schema.index(
  { consultantAccountId: 1, entityAccountId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export default (mongoose.models.ConsultantRoster as mongoose.Model<IConsultantRoster>) ?? mongoose.model<IConsultantRoster>('ConsultantRoster', schema);
```

- [ ] **Step 2: Commit**

```bash
git add server/models/ConsultantRoster.ts
git commit -m "feat(model): ConsultantRoster with partial-unique active index"
```

---

### Task 7: Create `Interview` and `Placement` models

**Files:**
- Create: `server/models/Interview.ts`
- Create: `server/models/Placement.ts`

- [ ] **Step 1: Write Interview model**

Create `server/models/Interview.ts`:

```ts
import mongoose, { Schema, Document } from 'mongoose';

export type InterviewMode = 'in_person' | 'video' | 'phone';
export type InterviewStatus = 'scheduled' | 'rescheduled' | 'completed' | 'canceled' | 'no_show';
export type InterviewOutcome = 'recommend_hire' | 'hold' | 'reject';

export interface IInterview extends Document {
  applicationId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  teacherAccountId: mongoose.Types.ObjectId;
  instituteAccountId: mongoose.Types.ObjectId;
  scheduledByAccountId: mongoose.Types.ObjectId;
  round: number;
  mode: InterviewMode;
  scheduledAt: Date;
  durationMinutes: number;
  location?: string;
  meetingLink?: string;
  participants: mongoose.Types.ObjectId[];
  status: InterviewStatus;
  rescheduleReason?: string;
  notesBefore?: string;
  outcome?: InterviewOutcome;
  notesAfter?: string;
  consultantId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IInterview>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    teacherAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    instituteAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    scheduledByAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    round: { type: Number, default: 1, min: 1 },
    mode: { type: String, enum: ['in_person', 'video', 'phone'], required: true },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 30, min: 5 },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
    status: { type: String, enum: ['scheduled', 'rescheduled', 'completed', 'canceled', 'no_show'], default: 'scheduled' },
    rescheduleReason: { type: String, trim: true },
    notesBefore: { type: String, trim: true },
    outcome: { type: String, enum: ['recommend_hire', 'hold', 'reject'] },
    notesAfter: { type: String, trim: true },
    consultantId: { type: Schema.Types.ObjectId, ref: 'Account' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ teacherAccountId: 1, status: 1, scheduledAt: -1 });
schema.index({ instituteAccountId: 1, status: 1, scheduledAt: -1 });
schema.index({ consultantId: 1, status: 1 });
schema.index({ applicationId: 1, round: 1 });

export default (mongoose.models.Interview as mongoose.Model<IInterview>) ?? mongoose.model<IInterview>('Interview', schema);
```

- [ ] **Step 2: Write Placement model**

Create `server/models/Placement.ts`:

```ts
import mongoose, { Schema, Document } from 'mongoose';

export type PlacementStage =
  | 'proposed'
  | 'applied'
  | 'interviewing'
  | 'offer_extended'
  | 'placed'
  | 'declined'
  | 'lost';

export const ACTIVE_PLACEMENT_STAGES: PlacementStage[] = ['proposed', 'applied', 'interviewing', 'offer_extended'];

export interface IPlacement extends Document {
  consultantAccountId: mongoose.Types.ObjectId;
  teacherAccountId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  applicationId?: mongoose.Types.ObjectId;
  stage: PlacementStage;
  agreedFee?: number;
  agreedFeeNotes?: string;
  stageHistory: Array<{
    stage: PlacementStage;
    changedAt: Date;
    changedByAccountId: mongoose.Types.ObjectId;
    reason?: string;
  }>;
  lastActivityAt: Date;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPlacement>(
  {
    consultantAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    teacherAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    stage: {
      type: String,
      enum: ['proposed', 'applied', 'interviewing', 'offer_extended', 'placed', 'declined', 'lost'],
      default: 'proposed',
    },
    agreedFee: { type: Number, min: 0 },
    agreedFeeNotes: { type: String, trim: true },
    stageHistory: [{
      stage: String,
      changedAt: { type: Date, default: Date.now },
      changedByAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
      reason: String,
    }],
    lastActivityAt: { type: Date, default: Date.now },
    internalNotes: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ consultantAccountId: 1, stage: 1, lastActivityAt: -1 });
schema.index({ teacherAccountId: 1, stage: 1 });
schema.index({ jobId: 1 });
schema.index(
  { consultantAccountId: 1, teacherAccountId: 1, jobId: 1 },
  {
    unique: true,
    partialFilterExpression: { stage: { $in: ['proposed', 'applied', 'interviewing', 'offer_extended'] } },
  }
);

export default (mongoose.models.Placement as mongoose.Model<IPlacement>) ?? mongoose.model<IPlacement>('Placement', schema);
```

- [ ] **Step 3: Commit**

```bash
git add server/models/Interview.ts server/models/Placement.ts
git commit -m "feat(model): Interview and Placement entities for consultant pipeline"
```

---

# Phase 2 — Auth (server)

### Task 8: Add `signupConsultant` to authService + tests

**Files:**
- Modify: `server/services/authService.ts`
- Create: `server/tests/integration/consultant-signup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/tests/integration/consultant-signup.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  await SubscriptionPlan.create({
    name: 'cons-free', displayName: 'Consultant Free', planType: 'consultant',
    description: 'd', price: 0, duration: 30,
    features: {
      maxBrowsesPerMonth: 100,
      maxRosterTeachers: 25, maxApplicationsPerMonth: 10, maxPlacementsPerMonth: 3,
      canViewTeacherContact: false,
      dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic',
    },
    isActive: true,
  });
});

describe('POST /api/auth/consultant/signup', () => {
  it('creates Account + ConsultantProfile + Subscription and returns bundle', async () => {
    const res = await request(app).post('/api/auth/consultant/signup').send({
      name: 'C. Broker', email: 'cons@e.com', password: 'pwpwpw', phone: '+91 999',
      agencyName: 'Acme Recruiters',
      yearsOfExperience: 7,
      specializations: { subjects: ['Math'], levels: ['Secondary'], regions: ['Bengaluru'] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.account.role).toBe('consultant');
    expect(res.body.data.profile.agencyName).toBe('Acme Recruiters');
    expect(res.body.data.profile.specializations.subjects).toContain('Math');
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=/);
  });

  it('returns 409 on duplicate email', async () => {
    const body = {
      name: 'C', email: 'dup-c@e.com', password: 'pwpwpw',
      yearsOfExperience: 1,
      specializations: { subjects: [], levels: [], regions: [] },
    };
    await request(app).post('/api/auth/consultant/signup').send(body);
    const res = await request(app).post('/api/auth/consultant/signup').send(body);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pnpm vitest run tests/integration/consultant-signup.test.ts`
Expected: FAIL — route `/auth/consultant/signup` returns 404 (handler doesn't exist).

- [ ] **Step 3: Add ConsultantProfile import to authService**

In `server/services/authService.ts`, add import after the `VendorProfile` import line (line 5):

```ts
import ConsultantProfile from '../models/ConsultantProfile.js';
```

- [ ] **Step 4: Add `signupConsultant` to authService**

In `server/services/authService.ts`, after the closing brace of `signupVendor` (line 260), insert:

```ts
export interface ConsultantSignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  agencyName?: string;
  registrationNumber?: string;
  yearsOfExperience: number;
  specializations: { subjects: string[]; levels: string[]; regions: string[] };
  bio?: string;
  website?: string;
  address?: Partial<Address>;
}

export async function signupConsultant(input: ConsultantSignupInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'consultant',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isActive: true,
            isVerified: false,
          },
        ],
        { session }
      );
      const [profile] = await ConsultantProfile.create(
        [
          {
            accountId: account._id,
            agencyName: input.agencyName,
            registrationNumber: input.registrationNumber,
            yearsOfExperience: input.yearsOfExperience,
            specializations: input.specializations,
            bio: input.bio,
            website: input.website,
            phone: input.phone,
            address: input.address,
          },
        ],
        { session }
      );
      const plan = await SubscriptionPlan.findOne({
        planType: 'consultant',
        price: 0,
        isActive: true,
      }).session(session);
      const [subscription] = await Subscription.create(
        [defaultSubscriptionFromPlan(account._id, plan)],
        { session }
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}
```

- [ ] **Step 5: Add consultant to `PROFILE_MODEL_BY_ROLE`**

In `server/services/authService.ts`, update the `PROFILE_MODEL_BY_ROLE` constant (around line 262):

```ts
const PROFILE_MODEL_BY_ROLE: Record<string, any> = {
  institute: InstituteProfile,
  teacher: TeacherProfile,
  vendor: VendorProfile,
  consultant: ConsultantProfile,
  admin: StaffProfile,
  marketing: StaffProfile,
  sales: StaffProfile,
};
```

- [ ] **Step 6: Add controller handler**

In `server/controllers/authController.ts`, after the `signupVendor` export (which ends with `} catch (e) { handleErr(res, e); }`), insert:

```ts
export const signupConsultant = async (req: Request, res: Response): Promise<void> => {
  try {
    const bundle = await authService.signupConsultant(req.body);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(201).json({ success: true, data: bundle, message: 'Consultant registered', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};
```

- [ ] **Step 7: Add route**

In `server/routes/auth.ts`, change the imports block to include `signupConsultant`:

```ts
import {
  signupInstitute,
  signupTeacher,
  signupVendor,
  signupConsultant,
  login,
  logout,
  me,
  validateToken,
  refreshToken,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
```

Then add a route line after `router.post('/vendor/signup', signupVendor);`:

```ts
router.post('/consultant/signup', signupConsultant);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && pnpm vitest run tests/integration/consultant-signup.test.ts`
Expected: PASS — both test cases green.

- [ ] **Step 9: Commit**

```bash
git add server/services/authService.ts server/controllers/authController.ts server/routes/auth.ts server/tests/integration/consultant-signup.test.ts
git commit -m "feat(auth): consultant signup with transactional Account+Profile+Subscription"
```

---

### Task 9: Add `adminCreateConsultant` to authService

**Files:**
- Modify: `server/services/authService.ts`

- [ ] **Step 1: Add admin-create helper**

At the bottom of `server/services/authService.ts` (after `adminCreateStaff`), append:

```ts
export interface AdminCreateConsultantInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  agencyName?: string;
  registrationNumber?: string;
  yearsOfExperience: number;
  specializations: { subjects: string[]; levels: string[]; regions: string[] };
  bio?: string;
  website?: string;
  address?: Partial<{ street: string; city: string; state: string; pincode: string; country: string }>;
  planId?: string;
  isVerified?: boolean;
}

export async function adminCreateConsultant(input: AdminCreateConsultantInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'consultant',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isVerified: input.isVerified ?? true,
            isActive: true,
          },
        ],
        { session }
      );
      const [profile] = await ConsultantProfile.create(
        [
          {
            accountId: account._id,
            agencyName: input.agencyName,
            registrationNumber: input.registrationNumber,
            yearsOfExperience: input.yearsOfExperience,
            specializations: input.specializations,
            bio: input.bio,
            website: input.website,
            phone: input.phone,
            address: input.address,
          },
        ],
        { session }
      );
      const subscription = await createSubscriptionForAccount(
        account._id,
        'consultant',
        input.planId,
        session,
        input.planId ? 'Plan assigned on admin onboarding' : 'Free plan assigned on admin onboarding'
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/authService.ts
git commit -m "feat(auth): adminCreateConsultant helper for staff onboarding"
```

---

### Task 10: Seed consultant1@edufleet.test + free plan

**Files:**
- Modify: `server/scripts/seedData/accounts.ts`

- [ ] **Step 1: Add consultant free plan to `ensureFreePlans`**

In `server/scripts/seedData/accounts.ts`, change the `planSpecs` array inside `ensureFreePlans()` to include the consultant tier:

```ts
const planSpecs: Array<['institute' | 'teacher' | 'vendor' | 'consultant', string, string]> = [
  ['institute',  'institute-free',  'Institute Free'],
  ['teacher',    'teacher-free',    'Teacher Free'],
  ['vendor',     'vendor-free',     'Vendor Free'],
  ['consultant', 'consultant-free', 'Consultant Free'],
];
```

Then, inside the same loop, replace the existing `features` block so the consultant plan ships with its own quota:

```ts
const featuresByType: Record<string, any> = {
  institute: { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
  teacher:   { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
  vendor:    { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
  consultant: { maxBrowsesPerMonth: 200, maxRosterTeachers: 25, maxRosterInstitutes: 25, maxApplicationsPerMonth: 10, maxPlacementsPerMonth: 3, canViewTeacherContact: false, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
};
await SubscriptionPlan.create({
  name, displayName, planType,
  description: `${displayName} plan`,
  price: 0, duration: 30,
  features: featuresByType[planType],
  isActive: true,
});
```

- [ ] **Step 2: Seed a consultant persona**

In the same file, inside `seedExternalPersonas()` (after the vendor block), add:

```ts
if (!await exists('consultant1@edufleet.test')) {
  await authService.signupConsultant({
    name: 'P. Recruiter', email: 'consultant1@edufleet.test', password: DEFAULT_PASSWORD, phone: '+91 1234567893',
    agencyName: 'Bengaluru Education Partners',
    yearsOfExperience: 8,
    specializations: { subjects: ['Math', 'Science'], levels: ['Secondary'], regions: ['Bengaluru', 'Mysore'] },
    bio: 'Senior K-12 placement consultant.',
  });
  console.log('✓ seeded consultant consultant1@edufleet.test');
}
```

- [ ] **Step 3: Run seed manually to verify**

Run: `cd server && pnpm tsx scripts/seed.ts`
Expected: Output includes `✓ seeded plan consultant-free` and `✓ seeded consultant consultant1@edufleet.test`.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/seedData/accounts.ts
git commit -m "chore(seed): consultant free plan + consultant1@edufleet.test"
```

---

# Phase 3 — Roster + Teacher consent (server)

### Task 11: Roster CRUD endpoints

**Files:**
- Create: `server/controllers/rosterController.ts`
- Create: `server/routes/roster.ts`
- Modify: `server/index.ts`
- Create: `server/tests/integration/consultant-roster.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/tests/integration/consultant-roster.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import rosterRoutes from '../../routes/roster.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;

async function signupConsultant(): Promise<string> {
  const res = await request(app).post('/api/auth/consultant/signup').send({
    name: 'C', email: `c-${Date.now()}@e.com`, password: 'pwpwpw',
    yearsOfExperience: 5,
    specializations: { subjects: [], levels: [], regions: [] },
  });
  return res.headers['set-cookie'][0];
}

async function signupTeacher(): Promise<string> {
  const res = await request(app).post('/api/auth/teacher/signup').send({
    name: 'T', email: `t-${Date.now()}@e.com`, password: 'pwpwpw',
    experience: 3, qualifications: ['B.Ed.'], subjects: ['Math'],
  });
  return res.body.data.account.id;
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/roster', rosterRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'Consultant Free', planType: 'consultant',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'Teacher Free', planType: 'teacher',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/roster', () => {
  it('consultant can add a teacher to their roster', async () => {
    const cookie = await signupConsultant();
    const teacherId = await signupTeacher();
    const res = await request(app).post('/api/roster').set('Cookie', cookie).send({
      entityType: 'teacher', entityAccountId: teacherId, internalNotes: 'Strong Math candidate',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.entityAccountId).toBe(teacherId);
    expect(res.body.data.status).toBe('active');
  });

  it('returns 409 when adding the same teacher twice while active', async () => {
    const cookie = await signupConsultant();
    const teacherId = await signupTeacher();
    await request(app).post('/api/roster').set('Cookie', cookie).send({
      entityType: 'teacher', entityAccountId: teacherId,
    });
    const res = await request(app).post('/api/roster').set('Cookie', cookie).send({
      entityType: 'teacher', entityAccountId: teacherId,
    });
    expect(res.status).toBe(409);
  });

  it('returns 403 when caller is not a consultant', async () => {
    const teacherCookie = (await request(app).post('/api/auth/teacher/signup').send({
      name: 'T2', email: 't2@e.com', password: 'pwpwpw',
      experience: 1, qualifications: [], subjects: ['Math'],
    })).headers['set-cookie'][0];
    const otherTeacherId = await signupTeacher();
    const res = await request(app).post('/api/roster').set('Cookie', teacherCookie).send({
      entityType: 'teacher', entityAccountId: otherTeacherId,
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/roster', () => {
  it('lists own roster, paginated', async () => {
    const cookie = await signupConsultant();
    const t1 = await signupTeacher();
    const t2 = await signupTeacher();
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: t1 });
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: t2 });
    const res = await request(app).get('/api/roster?entityType=teacher&page=1&pageSize=10').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
  });
});

describe('PATCH/DELETE /api/roster/:id', () => {
  it('patches notes/tags', async () => {
    const cookie = await signupConsultant();
    const t1 = await signupTeacher();
    const addRes = await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: t1 });
    const id = addRes.body.data.id;
    const patchRes = await request(app).patch(`/api/roster/${id}`).set('Cookie', cookie).send({ internalNotes: 'updated', tags: ['priority'] });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.internalNotes).toBe('updated');
    expect(patchRes.body.data.tags).toEqual(['priority']);
  });

  it('archives via DELETE (soft)', async () => {
    const cookie = await signupConsultant();
    const t1 = await signupTeacher();
    const addRes = await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: t1 });
    const id = addRes.body.data.id;
    const delRes = await request(app).delete(`/api/roster/${id}`).set('Cookie', cookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.status).toBe('archived');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pnpm vitest run tests/integration/consultant-roster.test.ts`
Expected: FAIL — route `/api/roster` does not exist yet.

- [ ] **Step 3: Write the controller**

Create `server/controllers/rosterController.ts`:

```ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ConsultantRoster from '../models/ConsultantRoster.js';
import Account from '../models/Account.js';

function ok(res: Response, data: any, status = 200) {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ success: false, error, code });
}

export const createRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  const { entityType, entityAccountId, internalNotes, tags } = req.body || {};
  if (!entityType || !entityAccountId) {
    err(res, 400, 'entityType and entityAccountId required', 'MISSING_FIELDS');
    return;
  }
  const target = await Account.findById(entityAccountId);
  if (!target) {
    err(res, 404, 'Target account not found', 'NOT_FOUND');
    return;
  }
  if (entityType === 'teacher' && target.role !== 'teacher') {
    err(res, 400, 'entityAccountId is not a teacher', 'INVALID_TARGET');
    return;
  }
  if (entityType === 'institute' && target.role !== 'institute') {
    err(res, 400, 'entityAccountId is not an institute', 'INVALID_TARGET');
    return;
  }
  try {
    const entry = await ConsultantRoster.create({
      consultantAccountId: req.account!.id,
      entityType,
      entityAccountId,
      internalNotes,
      tags,
    });
    ok(res, entry.toJSON(), 201);
  } catch (e: any) {
    if (e.code === 11000) { err(res, 409, 'Already in roster', 'DUPLICATE'); return; }
    err(res, 500, e.message ?? 'Failed to add', 'CREATE_FAILED');
  }
};

export const listRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)));
  const filter: any = { consultantAccountId: req.account!.id };
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.status) filter.status = req.query.status;
  else filter.status = 'active';

  const [items, total] = await Promise.all([
    ConsultantRoster.find(filter)
      .populate('entityAccountId', 'name email avatar role')
      .sort({ addedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ConsultantRoster.countDocuments(filter),
  ]);
  ok(res, {
    items: items.map((i) => i.toJSON()),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  });
};

export const patchRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await ConsultantRoster.findOne({
    _id: req.params.id,
    consultantAccountId: req.account!.id,
  });
  if (!entry) { err(res, 404, 'Roster entry not found', 'NOT_FOUND'); return; }
  const { internalNotes, tags, status } = req.body || {};
  if (internalNotes !== undefined) entry.internalNotes = internalNotes;
  if (tags !== undefined) entry.tags = tags;
  if (status !== undefined) {
    entry.status = status;
    if (status === 'archived') entry.archivedAt = new Date();
  }
  await entry.save();
  ok(res, entry.toJSON());
};

export const archiveRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await ConsultantRoster.findOne({
    _id: req.params.id,
    consultantAccountId: req.account!.id,
  });
  if (!entry) { err(res, 404, 'Roster entry not found', 'NOT_FOUND'); return; }
  entry.status = 'archived';
  entry.archivedAt = new Date();
  await entry.save();
  ok(res, entry.toJSON());
};
```

- [ ] **Step 4: Write the route**

Create `server/routes/roster.ts`:

```ts
import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRoster, listRoster, patchRoster, archiveRoster } from '../controllers/rosterController.js';

const router = express.Router();

router.use(authenticate, requireRole('consultant'));
router.get('/', listRoster);
router.post('/', createRoster);
router.patch('/:id', patchRoster);
router.delete('/:id', archiveRoster);

export default router;
```

- [ ] **Step 5: Register route in app**

In `server/index.ts`, find the block where existing routes are registered (`app.use('/api/...')` lines) and add:

```ts
import rosterRoutes from './routes/roster.js';
// ... below other app.use lines:
app.use('/api/roster', rosterRoutes);
```

- [ ] **Step 6: Run tests and verify they pass**

Run: `cd server && pnpm vitest run tests/integration/consultant-roster.test.ts`
Expected: PASS — all four `describe` blocks green.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/rosterController.ts server/routes/roster.ts server/index.ts server/tests/integration/consultant-roster.test.ts
git commit -m "feat(roster): consultant CRUD with partial-unique active guard"
```

---

### Task 12: Teacher `consultantConsent` PATCH endpoint

**Files:**
- Modify: `server/routes/teachers.ts` (find current location)
- Modify: `server/controllers/` (whichever module owns teacher routes)
- Create: `server/tests/integration/teacher-consent.test.ts`

- [ ] **Step 1: Locate existing teachers route module**

Run: `cd server && grep -n "PATCH\|router\." routes/teachers.ts | head -20`
Read the file to identify the controller pattern used. The new endpoint should follow that pattern (named export controller function + route line).

- [ ] **Step 2: Write the failing test**

Create `server/tests/integration/teacher-consent.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import teacherRoutes from '../../routes/teachers.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import TeacherProfile from '../../models/TeacherProfile.js';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/teachers', teacherRoutes);
  await SubscriptionPlan.create({
    name: 'teach-free', displayName: 'T', planType: 'teacher',
    description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true,
  });
});

describe('PATCH /api/teachers/me/consultant-consent', () => {
  it('teacher can grant consent (scope=any)', async () => {
    const signup = await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: 't@e.com', password: 'pwpwpw',
      experience: 3, qualifications: ['B.Ed.'], subjects: ['Math'],
    });
    const cookie = signup.headers['set-cookie'][0];
    const accountId = signup.body.data.account.id;

    const res = await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', cookie).send({
      granted: true, scope: 'any',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.consultantConsent.granted).toBe(true);

    const profile = await TeacherProfile.findOne({ accountId });
    expect(profile?.consultantConsent?.granted).toBe(true);
    expect(profile?.consultantConsent?.grantedAt).toBeTruthy();
  });

  it('teacher can revoke consent', async () => {
    const signup = await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: 't2@e.com', password: 'pwpwpw',
      experience: 3, qualifications: ['B.Ed.'], subjects: ['Math'],
    });
    const cookie = signup.headers['set-cookie'][0];
    await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', cookie).send({ granted: true, scope: 'any' });

    const res = await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', cookie).send({ granted: false });
    expect(res.status).toBe(200);
    expect(res.body.data.consultantConsent.granted).toBe(false);
    expect(res.body.data.consultantConsent.revokedAt).toBeTruthy();
  });

  it('returns 403 when caller is not a teacher', async () => {
    await SubscriptionPlan.create({
      name: 'inst-free', displayName: 'I', planType: 'institute',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true,
    });
    const inst = await request(app).post('/api/auth/institute/signup').send({
      name: 'I', email: 'i@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const cookie = inst.headers['set-cookie'][0];
    const res = await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', cookie).send({ granted: true });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && pnpm vitest run tests/integration/teacher-consent.test.ts`
Expected: FAIL — endpoint returns 404.

- [ ] **Step 4: Add controller function**

In `server/controllers/teacherController.ts` (or whichever file holds teacher controllers — confirm via grep in Step 1), append:

```ts
export const patchConsultantConsent = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.account?.role !== 'teacher') {
    res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }
  const profile = await TeacherProfile.findOne({ accountId: req.account.id });
  if (!profile) {
    res.status(404).json({ success: false, error: 'Profile not found', code: 'NOT_FOUND' });
    return;
  }
  const { granted, scope, allowedConsultantAccountIds } = req.body || {};
  const prev = profile.consultantConsent ?? { granted: false, scope: 'any' as const };
  profile.consultantConsent = {
    granted: !!granted,
    grantedAt: granted ? new Date() : prev.grantedAt,
    revokedAt: !granted && prev.granted ? new Date() : prev.revokedAt,
    scope: scope ?? prev.scope ?? 'any',
    allowedConsultantAccountIds: allowedConsultantAccountIds ?? prev.allowedConsultantAccountIds ?? [],
  };
  await profile.save();
  res.status(200).json({ success: true, data: profile.toJSON(), timestamp: new Date().toISOString() });
};
```

If the controller file doesn't yet import `TeacherProfile`, add:

```ts
import TeacherProfile from '../models/TeacherProfile.js';
```

- [ ] **Step 5: Register the route**

In `server/routes/teachers.ts`, add (with appropriate import):

```ts
import { patchConsultantConsent } from '../controllers/teacherController.js';
router.patch('/me/consultant-consent', authenticate, patchConsultantConsent);
```

(If `authenticate` is already applied via `router.use(authenticate, ...)`, drop the inline `authenticate` argument.)

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && pnpm vitest run tests/integration/teacher-consent.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/routes/teachers.ts server/controllers/teacherController.ts server/tests/integration/teacher-consent.test.ts
git commit -m "feat(teachers): consultantConsent PATCH endpoint"
```

---

# Phase 4 — Applications + Placements (server)

### Task 13: Placement service (stage transitions + history)

**Files:**
- Create: `server/services/placementService.ts`

- [ ] **Step 1: Write the service**

Create `server/services/placementService.ts`:

```ts
import mongoose from 'mongoose';
import Placement, { PlacementStage, ACTIVE_PLACEMENT_STAGES } from '../models/Placement.js';

const ALLOWED_TRANSITIONS: Record<PlacementStage, PlacementStage[]> = {
  proposed:       ['applied', 'lost'],
  applied:        ['interviewing', 'declined', 'lost'],
  interviewing:   ['offer_extended', 'declined', 'lost'],
  offer_extended: ['placed', 'declined', 'lost'],
  placed:         [],
  declined:       [],
  lost:           [],
};

export function canTransition(from: PlacementStage, to: PlacementStage): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface CreatePlacementInput {
  consultantAccountId: string;
  teacherAccountId: string;
  jobId: string;
  applicationId?: string;
  initialStage?: PlacementStage;
  internalNotes?: string;
  agreedFee?: number;
}

export async function createPlacement(input: CreatePlacementInput) {
  const stage = input.initialStage ?? 'proposed';
  const doc = await Placement.create({
    consultantAccountId: input.consultantAccountId,
    teacherAccountId: input.teacherAccountId,
    jobId: input.jobId,
    applicationId: input.applicationId,
    stage,
    internalNotes: input.internalNotes,
    agreedFee: input.agreedFee,
    stageHistory: [
      {
        stage,
        changedAt: new Date(),
        changedByAccountId: new mongoose.Types.ObjectId(input.consultantAccountId),
        reason: 'Created',
      },
    ],
    lastActivityAt: new Date(),
  });
  return doc;
}

export async function transitionStage(
  placementId: string,
  toStage: PlacementStage,
  changedByAccountId: string,
  reason?: string
) {
  const placement = await Placement.findById(placementId);
  if (!placement) throw new Error('Placement not found');
  if (!canTransition(placement.stage, toStage)) {
    throw new Error(`Cannot transition from ${placement.stage} to ${toStage}`);
  }
  placement.stage = toStage;
  placement.stageHistory.push({
    stage: toStage,
    changedAt: new Date(),
    changedByAccountId: new mongoose.Types.ObjectId(changedByAccountId),
    reason,
  });
  placement.lastActivityAt = new Date();
  await placement.save();
  return placement;
}

export function isActiveStage(stage: PlacementStage): boolean {
  return ACTIVE_PLACEMENT_STAGES.includes(stage);
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/placementService.ts
git commit -m "feat(placement): stage-transition validation + history append"
```

---

### Task 14: Placement CRUD endpoints

**Files:**
- Create: `server/controllers/placementController.ts`
- Create: `server/routes/placements.ts`
- Modify: `server/index.ts`
- Create: `server/tests/integration/consultant-placements.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/tests/integration/consultant-placements.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import placementRoutes from '../../routes/placements.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Job from '../../models/Job.js';
import mongoose from 'mongoose';

let app: express.Express;

async function seedConsultant(): Promise<string> {
  const res = await request(app).post('/api/auth/consultant/signup').send({
    name: 'C', email: `c-${Date.now()}@e.com`, password: 'pwpwpw',
    yearsOfExperience: 5, specializations: { subjects: [], levels: [], regions: [] },
  });
  return res.headers['set-cookie'][0];
}
async function seedTeacher(): Promise<string> {
  const res = await request(app).post('/api/auth/teacher/signup').send({
    name: 'T', email: `t-${Date.now()}@e.com`, password: 'pwpwpw',
    experience: 1, qualifications: [], subjects: ['Math'],
  });
  return res.body.data.account.id;
}
async function seedJob(): Promise<string> {
  const job = await Job.create({
    title: 'Math Teacher', description: 'd',
    instituteId: new mongoose.Types.ObjectId(), instituteName: 'X',
    subjects: ['Math'], minimumExperience: 1, maximumExperience: 10,
    location: 'Bengaluru', salaryRange: { min: 30000, max: 50000 },
    status: 'active',
  });
  return String(job._id);
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/placements', placementRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'C', planType: 'consultant',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/placements', () => {
  it('consultant creates a proposed placement', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    const res = await request(app).post('/api/placements').set('Cookie', cookie).send({
      teacherAccountId: teacherId, jobId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.stage).toBe('proposed');
    expect(res.body.data.stageHistory).toHaveLength(1);
  });

  it('returns 409 on duplicate active placement for same (teacher, job)', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    const res = await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/placements/:id', () => {
  it('valid stage transition proposed -> applied appends history', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    const created = await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    const id = created.body.data.id;
    const res = await request(app).patch(`/api/placements/${id}`).set('Cookie', cookie).send({ stage: 'applied', reason: 'Submitted application' });
    expect(res.status).toBe(200);
    expect(res.body.data.stage).toBe('applied');
    expect(res.body.data.stageHistory).toHaveLength(2);
  });

  it('rejects invalid skip proposed -> placed with 400', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    const created = await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    const id = created.body.data.id;
    const res = await request(app).patch(`/api/placements/${id}`).set('Cookie', cookie).send({ stage: 'placed' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/placements', () => {
  it('lists own placements paginated and filtered by stage', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    const res = await request(app).get('/api/placements?stage=proposed').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].stage).toBe('proposed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pnpm vitest run tests/integration/consultant-placements.test.ts`
Expected: FAIL — `/api/placements` doesn't exist.

- [ ] **Step 3: Write the controller**

Create `server/controllers/placementController.ts`:

```ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Placement from '../models/Placement.js';
import { createPlacement, transitionStage } from '../services/placementService.js';

function ok(res: Response, data: any, status = 200) {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ success: false, error, code });
}

export const createPlacementHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { teacherAccountId, jobId, applicationId, internalNotes, agreedFee, initialStage } = req.body || {};
  if (!teacherAccountId || !jobId) {
    err(res, 400, 'teacherAccountId and jobId required', 'MISSING_FIELDS');
    return;
  }
  try {
    const placement = await createPlacement({
      consultantAccountId: String(req.account!.id),
      teacherAccountId, jobId, applicationId, internalNotes, agreedFee, initialStage,
    });
    ok(res, placement.toJSON(), 201);
  } catch (e: any) {
    if (e.code === 11000) { err(res, 409, 'Active placement already exists for this (teacher, job)', 'DUPLICATE'); return; }
    err(res, 500, e.message ?? 'Failed to create placement', 'CREATE_FAILED');
  }
};

export const listPlacements = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)));
  const filter: any = { consultantAccountId: req.account!.id };
  if (req.query.stage) filter.stage = req.query.stage;
  const [items, total] = await Promise.all([
    Placement.find(filter)
      .populate('teacherAccountId', 'name email avatar')
      .populate('jobId', 'title instituteName location')
      .sort({ lastActivityAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Placement.countDocuments(filter),
  ]);
  ok(res, {
    items: items.map((i) => i.toJSON()),
    total, page, pageSize,
    hasMore: page * pageSize < total,
  });
};

export const patchPlacement = async (req: AuthRequest, res: Response): Promise<void> => {
  const placement = await Placement.findOne({
    _id: req.params.id,
    consultantAccountId: req.account!.id,
  });
  if (!placement) { err(res, 404, 'Placement not found', 'NOT_FOUND'); return; }
  const { stage, reason, internalNotes, agreedFee, agreedFeeNotes } = req.body || {};
  try {
    if (stage && stage !== placement.stage) {
      await transitionStage(String(placement._id), stage, String(req.account!.id), reason);
    }
    if (internalNotes !== undefined || agreedFee !== undefined || agreedFeeNotes !== undefined) {
      const fresh = await Placement.findById(placement._id);
      if (!fresh) return;
      if (internalNotes !== undefined) fresh.internalNotes = internalNotes;
      if (agreedFee !== undefined) fresh.agreedFee = agreedFee;
      if (agreedFeeNotes !== undefined) fresh.agreedFeeNotes = agreedFeeNotes;
      fresh.lastActivityAt = new Date();
      await fresh.save();
      ok(res, fresh.toJSON());
      return;
    }
    const refreshed = await Placement.findById(placement._id);
    ok(res, refreshed!.toJSON());
  } catch (e: any) {
    if (/Cannot transition/.test(e.message)) {
      err(res, 400, e.message, 'INVALID_TRANSITION');
      return;
    }
    err(res, 500, e.message ?? 'Failed', 'PATCH_FAILED');
  }
};

export const placementTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  const placement = await Placement.findOne({
    _id: req.params.id,
    consultantAccountId: req.account!.id,
  });
  if (!placement) { err(res, 404, 'Placement not found', 'NOT_FOUND'); return; }
  ok(res, {
    placement: placement.toJSON(),
    stageHistory: placement.stageHistory,
  });
};
```

- [ ] **Step 4: Write the route**

Create `server/routes/placements.ts`:

```ts
import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  createPlacementHandler,
  listPlacements,
  patchPlacement,
  placementTimeline,
} from '../controllers/placementController.js';

const router = express.Router();
router.use(authenticate, requireRole('consultant'));
router.get('/', listPlacements);
router.post('/', createPlacementHandler);
router.patch('/:id', patchPlacement);
router.get('/:id/timeline', placementTimeline);

export default router;
```

- [ ] **Step 5: Register route in app**

In `server/index.ts`, add:

```ts
import placementRoutes from './routes/placements.js';
app.use('/api/placements', placementRoutes);
```

- [ ] **Step 6: Run tests and verify they pass**

Run: `cd server && pnpm vitest run tests/integration/consultant-placements.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/placementController.ts server/routes/placements.ts server/index.ts server/tests/integration/consultant-placements.test.ts
git commit -m "feat(placement): pipeline CRUD with stage transitions and timeline"
```

---

### Task 15: Extend application controller to accept consultant submissions

**Files:**
- Modify: `server/controllers/applicationController.ts` (locate via grep)
- Create: `server/tests/integration/consultant-applications.test.ts`

- [ ] **Step 1: Locate the existing application controller**

Run: `cd server && grep -nE "applyToJob|createApplication" controllers/*.ts routes/*.ts | head -10`
Identify the controller and the route — usually `POST /api/applications`.

- [ ] **Step 2: Write the failing test**

Create `server/tests/integration/consultant-applications.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import applicationRoutes from '../../routes/jobs.js'; // adjust if applications live in a different mount
import rosterRoutes from '../../routes/roster.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Job from '../../models/Job.js';
import mongoose from 'mongoose';
import Application from '../../models/Application.js';

let app: express.Express;

async function seedConsultant() {
  const res = await request(app).post('/api/auth/consultant/signup').send({
    name: 'C', email: `c-${Date.now()}@e.com`, password: 'pwpwpw',
    yearsOfExperience: 5, specializations: { subjects: [], levels: [], regions: [] },
  });
  return { cookie: res.headers['set-cookie'][0], id: res.body.data.account.id };
}
async function seedTeacher() {
  const res = await request(app).post('/api/auth/teacher/signup').send({
    name: 'T', email: `t-${Date.now()}@e.com`, password: 'pwpwpw',
    experience: 1, qualifications: [], subjects: ['Math'],
  });
  return { cookie: res.headers['set-cookie'][0], id: res.body.data.account.id };
}
async function seedJob() {
  const job = await Job.create({
    title: 'Math Teacher', description: 'd',
    instituteId: new mongoose.Types.ObjectId(), instituteName: 'X',
    subjects: ['Math'], minimumExperience: 1, maximumExperience: 10,
    location: 'Bengaluru', salaryRange: { min: 30000, max: 50000 },
    status: 'active',
  });
  return String(job._id);
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/jobs', applicationRoutes);
  app.use('/api/roster', rosterRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'C', planType: 'consultant', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/jobs/:id/apply by consultant', () => {
  it('403 when teacher has not granted consent', async () => {
    const { cookie } = await seedConsultant();
    const teacher = await seedTeacher();
    const jobId = await seedJob();
    // roster add
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: teacher.id });
    const res = await request(app).post(`/api/jobs/${jobId}/apply`).set('Cookie', cookie).send({
      teacherAccountId: teacher.id, coverLetter: 'On behalf',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toMatch(/CONSENT/);
  });

  it('201 with submittedByConsultantId when consent granted and teacher in roster', async () => {
    const { cookie, id: consultantId } = await seedConsultant();
    const teacher = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: teacher.id });
    await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', teacher.cookie).send({ granted: true, scope: 'any' });
    const res = await request(app).post(`/api/jobs/${jobId}/apply`).set('Cookie', cookie).send({
      teacherAccountId: teacher.id, coverLetter: 'On behalf',
    });
    expect(res.status).toBe(201);
    const appRow = await Application.findById(res.body.data.id);
    expect(String(appRow?.submittedByConsultantId)).toBe(consultantId);
    expect(String(appRow?.teacherId)).toBe(teacher.id);
  });

  it('403 when teacher consent scope=specific and consultant not in allowlist', async () => {
    const { cookie } = await seedConsultant();
    const teacher = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: teacher.id });
    await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', teacher.cookie).send({ granted: true, scope: 'specific', allowedConsultantAccountIds: [] });
    const res = await request(app).post(`/api/jobs/${jobId}/apply`).set('Cookie', cookie).send({
      teacherAccountId: teacher.id, coverLetter: 'X',
    });
    expect(res.status).toBe(403);
  });

  it('403 when teacher not in consultant roster', async () => {
    const { cookie } = await seedConsultant();
    const teacher = await seedTeacher();
    const jobId = await seedJob();
    await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', teacher.cookie).send({ granted: true, scope: 'any' });
    const res = await request(app).post(`/api/jobs/${jobId}/apply`).set('Cookie', cookie).send({
      teacherAccountId: teacher.id, coverLetter: 'X',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toMatch(/ROSTER/);
  });
});
```

(If your application route is mounted elsewhere — e.g. `/api/applications` — adjust the `app.use` line and URL.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && pnpm vitest run tests/integration/consultant-applications.test.ts`
Expected: FAIL — consultant submissions not supported yet.

- [ ] **Step 4: Extend the application controller**

In the existing application controller, find the handler for `POST /api/jobs/:id/apply` (or `/api/applications`). Modify the handler to detect a `consultant` role, validate the additional consent/roster requirements, and stamp `submittedByConsultantId`. Insert at the top of the handler (after auth check, before creation):

```ts
import TeacherProfile from '../models/TeacherProfile.js';
import ConsultantRoster from '../models/ConsultantRoster.js';
import mongoose from 'mongoose';

// ... inside the handler:
let actingTeacherId: string = String(req.account!.id);
let submittedByConsultantId: mongoose.Types.ObjectId | undefined;
if (req.account?.role === 'consultant') {
  const targetTeacherId = req.body?.teacherAccountId;
  if (!targetTeacherId) {
    res.status(400).json({ success: false, error: 'teacherAccountId required for consultant submissions', code: 'MISSING_TEACHER' });
    return;
  }
  const teacherProfile = await TeacherProfile.findOne({ accountId: targetTeacherId });
  if (!teacherProfile || !teacherProfile.consultantConsent?.granted) {
    res.status(403).json({ success: false, error: 'Teacher has not granted consultant consent', code: 'CONSENT_MISSING' });
    return;
  }
  if (teacherProfile.consultantConsent.scope === 'specific') {
    const allowed = (teacherProfile.consultantConsent.allowedConsultantAccountIds ?? []).map(String);
    if (!allowed.includes(String(req.account.id))) {
      res.status(403).json({ success: false, error: 'Consultant not in teacher allowlist', code: 'CONSENT_SCOPED' });
      return;
    }
  }
  const rosterEntry = await ConsultantRoster.findOne({
    consultantAccountId: req.account.id, entityAccountId: targetTeacherId, status: 'active',
  });
  if (!rosterEntry) {
    res.status(403).json({ success: false, error: 'Teacher not in your active roster', code: 'NOT_IN_ROSTER' });
    return;
  }
  actingTeacherId = String(targetTeacherId);
  submittedByConsultantId = new mongoose.Types.ObjectId(String(req.account.id));
}
```

Then in the application creation block, use `actingTeacherId` instead of `req.account.id` for the `teacherId`, and include `submittedByConsultantId` in the create payload. Example of the create call:

```ts
const application = await Application.create({
  jobId,
  teacherId: actingTeacherId,
  teacherName: teacherDoc.name,
  instituteId: jobDoc.instituteId,
  instituteName: jobDoc.instituteName,
  coverLetter: req.body?.coverLetter ?? '',
  submittedByConsultantId,
  statusHistory: [{ status: 'pending', changedAt: new Date(), changedBy: new mongoose.Types.ObjectId(String(req.account!.id)) }],
});
```

- [ ] **Step 5: Auto-create/advance a Placement when consultant submits**

In the same handler, immediately after the Application is created (and only if `submittedByConsultantId`), upsert a Placement and advance it to `applied`. Import:

```ts
import Placement from '../models/Placement.js';
import { createPlacement, transitionStage } from '../services/placementService.js';
```

Then, after Application.create:

```ts
if (submittedByConsultantId) {
  const existing = await Placement.findOne({
    consultantAccountId: req.account!.id,
    teacherAccountId: actingTeacherId,
    jobId,
    stage: { $in: ['proposed', 'applied', 'interviewing', 'offer_extended'] },
  });
  if (!existing) {
    await createPlacement({
      consultantAccountId: String(req.account!.id),
      teacherAccountId: actingTeacherId,
      jobId: String(jobId),
      applicationId: String(application._id),
      initialStage: 'applied',
    });
  } else if (existing.stage === 'proposed') {
    await transitionStage(String(existing._id), 'applied', String(req.account!.id), 'Application submitted');
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && pnpm vitest run tests/integration/consultant-applications.test.ts`
Expected: PASS — all four `it` blocks green.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/applicationController.ts server/tests/integration/consultant-applications.test.ts
git commit -m "feat(applications): consultant submit-on-behalf with consent+roster check"
```

---

# Phase 5 — Interviews (server)

### Task 16: Interview service with notification fan-out

**Files:**
- Create: `server/services/interviewService.ts`

- [ ] **Step 1: Write the service**

Create `server/services/interviewService.ts`:

```ts
import mongoose from 'mongoose';
import Interview, { InterviewMode, InterviewOutcome, InterviewStatus } from '../models/Interview.js';
import Notification from '../models/Notification.js';
import Application from '../models/Application.js';
import Placement from '../models/Placement.js';
import { transitionStage } from './placementService.js';

export interface ScheduleInterviewInput {
  applicationId: string;
  scheduledByAccountId: string;
  scheduledAt: Date;
  durationMinutes: number;
  mode: InterviewMode;
  location?: string;
  meetingLink?: string;
  participants?: string[];
  notesBefore?: string;
  round?: number;
}

async function notifyParticipants(args: {
  accountIds: string[];
  type: string;
  title: string;
  message: string;
  data?: any;
}) {
  const docs = args.accountIds.map((id) => ({
    accountId: new mongoose.Types.ObjectId(id),
    type: args.type,
    title: args.title,
    message: args.message,
    data: args.data,
    isRead: false,
  }));
  if (docs.length) {
    try { await Notification.insertMany(docs); } catch { /* notification failures are non-fatal */ }
  }
}

export async function scheduleInterview(input: ScheduleInterviewInput) {
  const application = await Application.findById(input.applicationId);
  if (!application) throw new Error('Application not found');
  const existingRoundCount = await Interview.countDocuments({ applicationId: input.applicationId });
  const round = input.round ?? existingRoundCount + 1;

  const consultantId = (application as any).submittedByConsultantId
    ? String((application as any).submittedByConsultantId)
    : undefined;

  const participants: string[] = input.participants && input.participants.length
    ? input.participants
    : [String(application.teacherId), String(application.instituteId), ...(consultantId ? [consultantId] : [])];

  const doc = await Interview.create({
    applicationId: application._id,
    jobId: application.jobId,
    teacherAccountId: application.teacherId,
    instituteAccountId: application.instituteId,
    scheduledByAccountId: new mongoose.Types.ObjectId(input.scheduledByAccountId),
    round,
    mode: input.mode,
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes,
    location: input.location,
    meetingLink: input.meetingLink,
    participants: participants.map((p) => new mongoose.Types.ObjectId(p)),
    status: 'scheduled',
    notesBefore: input.notesBefore,
    consultantId: consultantId ? new mongoose.Types.ObjectId(consultantId) : undefined,
  });

  await notifyParticipants({
    accountIds: participants,
    type: 'interview_invitation',
    title: `Interview scheduled (Round ${round})`,
    message: `An interview has been scheduled for ${input.scheduledAt.toISOString()}.`,
    data: { interviewId: String(doc._id), applicationId: input.applicationId },
  });

  if (consultantId) {
    const placement = await Placement.findOne({
      consultantAccountId: consultantId,
      teacherAccountId: application.teacherId,
      jobId: application.jobId,
      stage: { $in: ['applied'] },
    });
    if (placement) {
      try { await transitionStage(String(placement._id), 'interviewing', input.scheduledByAccountId, 'Interview scheduled'); } catch { /* swallow if not allowed */ }
    }
  }

  return doc;
}

export async function rescheduleInterview(
  interviewId: string,
  newScheduledAt: Date,
  changedByAccountId: string,
  reason?: string
) {
  const doc = await Interview.findById(interviewId);
  if (!doc) throw new Error('Interview not found');
  if (doc.status === 'completed' || doc.status === 'canceled') {
    throw new Error('Cannot reschedule a completed or canceled interview');
  }
  doc.scheduledAt = newScheduledAt;
  doc.status = 'rescheduled';
  doc.rescheduleReason = reason;
  await doc.save();
  await notifyParticipants({
    accountIds: doc.participants.map(String),
    type: 'interview_invitation',
    title: 'Interview rescheduled',
    message: `Interview moved to ${newScheduledAt.toISOString()}.`,
    data: { interviewId, applicationId: String(doc.applicationId) },
  });
  return doc;
}

export async function completeInterview(
  interviewId: string,
  outcome: InterviewOutcome,
  notesAfter: string | undefined,
  _changedByAccountId: string
) {
  const doc = await Interview.findById(interviewId);
  if (!doc) throw new Error('Interview not found');
  doc.status = 'completed';
  doc.outcome = outcome;
  doc.notesAfter = notesAfter;
  await doc.save();
  return doc;
}

export async function cancelInterview(
  interviewId: string,
  reason: string | undefined,
  _changedByAccountId: string
) {
  const doc = await Interview.findById(interviewId);
  if (!doc) throw new Error('Interview not found');
  doc.status = 'canceled';
  doc.rescheduleReason = reason;
  await doc.save();
  await notifyParticipants({
    accountIds: doc.participants.map(String),
    type: 'interview_invitation',
    title: 'Interview canceled',
    message: reason ?? 'The interview was canceled.',
    data: { interviewId, applicationId: String(doc.applicationId) },
  });
  return doc;
}

export async function listInterviewsForAccount(
  accountId: string,
  filters: { status?: InterviewStatus; from?: Date; to?: Date } = {}
) {
  const q: any = {
    $or: [
      { teacherAccountId: accountId },
      { instituteAccountId: accountId },
      { consultantId: accountId },
      { scheduledByAccountId: accountId },
    ],
  };
  if (filters.status) q.status = filters.status;
  if (filters.from || filters.to) {
    q.scheduledAt = {};
    if (filters.from) q.scheduledAt.$gte = filters.from;
    if (filters.to) q.scheduledAt.$lte = filters.to;
  }
  return Interview.find(q).sort({ scheduledAt: 1 });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/interviewService.ts
git commit -m "feat(interview): schedule/reschedule/complete/cancel + notification fan-out"
```

---

### Task 17: Interview CRUD endpoints + tests

**Files:**
- Create: `server/controllers/interviewController.ts`
- Create: `server/routes/interviews.ts`
- Modify: `server/index.ts`
- Create: `server/tests/integration/consultant-interviews.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/tests/integration/consultant-interviews.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import interviewRoutes from '../../routes/interviews.js';
import rosterRoutes from '../../routes/roster.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Job from '../../models/Job.js';
import Application from '../../models/Application.js';
import Notification from '../../models/Notification.js';
import mongoose from 'mongoose';

let app: express.Express;

async function setup() {
  const consSignup = await request(app).post('/api/auth/consultant/signup').send({
    name: 'C', email: `c-${Date.now()}@e.com`, password: 'pwpwpw',
    yearsOfExperience: 5, specializations: { subjects: [], levels: [], regions: [] },
  });
  const consultantCookie = consSignup.headers['set-cookie'][0];
  const consultantId = consSignup.body.data.account.id;

  const teachSignup = await request(app).post('/api/auth/teacher/signup').send({
    name: 'T', email: `t-${Date.now()}@e.com`, password: 'pwpwpw',
    experience: 3, qualifications: [], subjects: ['Math'],
  });
  const teacherId = teachSignup.body.data.account.id;

  const instSignup = await request(app).post('/api/auth/institute/signup').send({
    name: 'I', email: `i-${Date.now()}@e.com`, password: 'pwpwpw',
    instituteName: 'X',
    address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
  });
  const instituteId = instSignup.body.data.account.id;

  const job = await Job.create({
    title: 'Math Teacher', description: 'd',
    instituteId, instituteName: 'X',
    subjects: ['Math'], minimumExperience: 1, maximumExperience: 10,
    location: 'Bengaluru', salaryRange: { min: 30000, max: 50000 },
    status: 'active',
  });

  const application = await Application.create({
    jobId: job._id,
    teacherId, teacherName: 'T',
    instituteId, instituteName: 'X',
    coverLetter: 'X',
    submittedByConsultantId: consultantId,
    statusHistory: [],
  });

  return { consultantCookie, consultantId, teacherId, instituteId, jobId: String(job._id), applicationId: String(application._id) };
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/roster', rosterRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'C', planType: 'consultant', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/interviews', () => {
  it('schedules interview and notifies teacher + institute + consultant', async () => {
    const { consultantCookie, teacherId, instituteId, consultantId, applicationId } = await setup();
    const when = new Date(Date.now() + 86400000);
    const res = await request(app).post('/api/interviews').set('Cookie', consultantCookie).send({
      applicationId, scheduledAt: when.toISOString(), durationMinutes: 30, mode: 'video', meetingLink: 'https://meet.example/abc',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.round).toBe(1);
    const notifs = await Notification.find({ type: 'interview_invitation' });
    const ids = notifs.map((n) => String((n as any).accountId)).sort();
    expect(ids).toEqual([teacherId, instituteId, consultantId].sort());
  });

  it('PATCH reschedules and emits notifications again', async () => {
    const { consultantCookie, applicationId } = await setup();
    const when = new Date(Date.now() + 86400000);
    const created = await request(app).post('/api/interviews').set('Cookie', consultantCookie).send({
      applicationId, scheduledAt: when.toISOString(), durationMinutes: 30, mode: 'video',
    });
    const id = created.body.data.id;
    const newWhen = new Date(Date.now() + 2 * 86400000);
    const patch = await request(app).patch(`/api/interviews/${id}`).set('Cookie', consultantCookie).send({
      scheduledAt: newWhen.toISOString(), rescheduleReason: 'Conflict',
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('rescheduled');
  });

  it('PATCH completes with outcome', async () => {
    const { consultantCookie, applicationId } = await setup();
    const when = new Date(Date.now() + 86400000);
    const created = await request(app).post('/api/interviews').set('Cookie', consultantCookie).send({
      applicationId, scheduledAt: when.toISOString(), durationMinutes: 30, mode: 'video',
    });
    const id = created.body.data.id;
    const patch = await request(app).patch(`/api/interviews/${id}`).set('Cookie', consultantCookie).send({
      outcome: 'recommend_hire', notesAfter: 'Strong',
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('completed');
    expect(patch.body.data.outcome).toBe('recommend_hire');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pnpm vitest run tests/integration/consultant-interviews.test.ts`
Expected: FAIL — routes do not exist.

- [ ] **Step 3: Write the controller**

Create `server/controllers/interviewController.ts`:

```ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Interview from '../models/Interview.js';
import {
  scheduleInterview,
  rescheduleInterview,
  completeInterview,
  cancelInterview,
  listInterviewsForAccount,
} from '../services/interviewService.js';

function ok(res: Response, data: any, status = 200) {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ success: false, error, code });
}

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  const { applicationId, scheduledAt, durationMinutes, mode, location, meetingLink, participants, notesBefore, round } = req.body || {};
  if (!applicationId || !scheduledAt || !mode) {
    err(res, 400, 'applicationId, scheduledAt, mode required', 'MISSING_FIELDS');
    return;
  }
  try {
    const doc = await scheduleInterview({
      applicationId,
      scheduledByAccountId: String(req.account!.id),
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes ?? 30,
      mode, location, meetingLink, participants, notesBefore, round,
    });
    ok(res, doc.toJSON(), 201);
  } catch (e: any) {
    err(res, 500, e.message ?? 'Failed to schedule', 'CREATE_FAILED');
  }
};

export const patch = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const { scheduledAt, rescheduleReason, outcome, notesAfter, cancel } = req.body || {};
  try {
    if (cancel) {
      const doc = await cancelInterview(id, rescheduleReason, String(req.account!.id));
      ok(res, doc.toJSON());
      return;
    }
    if (outcome) {
      const doc = await completeInterview(id, outcome, notesAfter, String(req.account!.id));
      ok(res, doc.toJSON());
      return;
    }
    if (scheduledAt) {
      const doc = await rescheduleInterview(id, new Date(scheduledAt), String(req.account!.id), rescheduleReason);
      ok(res, doc.toJSON());
      return;
    }
    err(res, 400, 'No-op patch', 'NO_OP');
  } catch (e: any) {
    err(res, 500, e.message ?? 'Failed', 'PATCH_FAILED');
  }
};

export const list = async (req: AuthRequest, res: Response): Promise<void> => {
  const filters: any = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.from) filters.from = new Date(String(req.query.from));
  if (req.query.to) filters.to = new Date(String(req.query.to));
  const items = await listInterviewsForAccount(String(req.account!.id), filters);
  ok(res, { items: items.map((i) => i.toJSON()), total: items.length });
};

export const get = async (req: AuthRequest, res: Response): Promise<void> => {
  const doc = await Interview.findById(req.params.id);
  if (!doc) { err(res, 404, 'Interview not found', 'NOT_FOUND'); return; }
  const accountId = String(req.account!.id);
  const isParticipant =
    doc.participants.map(String).includes(accountId) ||
    String(doc.consultantId) === accountId ||
    String(doc.scheduledByAccountId) === accountId ||
    String(doc.teacherAccountId) === accountId ||
    String(doc.instituteAccountId) === accountId;
  if (!isParticipant && req.account!.role !== 'admin') {
    err(res, 403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  ok(res, doc.toJSON());
};
```

- [ ] **Step 4: Write the route**

Create `server/routes/interviews.ts`:

```ts
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { create, patch, list, get } from '../controllers/interviewController.js';

const router = express.Router();
router.use(authenticate);
router.get('/', list);
router.post('/', create);
router.get('/:id', get);
router.patch('/:id', patch);

export default router;
```

- [ ] **Step 5: Register route**

In `server/index.ts`, add:

```ts
import interviewRoutes from './routes/interviews.js';
app.use('/api/interviews', interviewRoutes);
```

- [ ] **Step 6: Run tests and verify they pass**

Run: `cd server && pnpm vitest run tests/integration/consultant-interviews.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/interviewController.ts server/routes/interviews.ts server/index.ts server/tests/integration/consultant-interviews.test.ts
git commit -m "feat(interview): schedule/reschedule/complete/cancel endpoints"
```

---

# Phase 6 — Consultant profile + Recommendations (server)

### Task 18: Consultant self-profile endpoints

**Files:**
- Create: `server/controllers/consultantController.ts`
- Create: `server/routes/consultants.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Write the controller**

Create `server/controllers/consultantController.ts`:

```ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ConsultantProfile from '../models/ConsultantProfile.js';
import { loadBundle } from '../services/authService.js';

function ok(res: Response, data: any, status = 200) {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ success: false, error, code });
}

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.account?.role !== 'consultant') { err(res, 403, 'Forbidden', 'FORBIDDEN'); return; }
  const bundle = await loadBundle(String(req.account.id));
  ok(res, bundle);
};

export const patchMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.account?.role !== 'consultant') { err(res, 403, 'Forbidden', 'FORBIDDEN'); return; }
  const profile = await ConsultantProfile.findOne({ accountId: req.account.id });
  if (!profile) { err(res, 404, 'Profile not found', 'NOT_FOUND'); return; }
  const allowed = ['agencyName', 'registrationNumber', 'yearsOfExperience', 'specializations', 'bio', 'website', 'phone', 'address'];
  for (const key of allowed) {
    if (req.body && key in req.body) (profile as any)[key] = req.body[key];
  }
  await profile.save();
  ok(res, profile.toJSON());
};

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  const profile = await ConsultantProfile.findOne({ accountId: req.params.id })
    .populate('accountId', 'name email avatar');
  if (!profile) { err(res, 404, 'Consultant not found', 'NOT_FOUND'); return; }
  ok(res, profile.toJSON());
};
```

- [ ] **Step 2: Write the route**

Create `server/routes/consultants.ts`:

```ts
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { me, patchMe, getById } from '../controllers/consultantController.js';

const router = express.Router();
router.get('/me', authenticate, me);
router.patch('/me', authenticate, patchMe);
router.get('/:id', authenticate, getById);

export default router;
```

- [ ] **Step 3: Register route**

In `server/index.ts`, add:

```ts
import consultantRoutes from './routes/consultants.js';
app.use('/api/consultants', consultantRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add server/controllers/consultantController.ts server/routes/consultants.ts server/index.ts
git commit -m "feat(consultant): self profile read/update endpoints"
```

---

### Task 19: Recommendations for consultants

**Files:**
- Modify: `server/services/matchService.ts`
- Modify: `server/routes/recommendations.ts`
- Modify: `server/controllers/` (the recommendations controller — locate via grep)
- Create: `server/tests/integration/consultant-recommendations.test.ts`

- [ ] **Step 1: Locate existing recommendations controller**

Run: `cd server && grep -nE "router\.|recommendJob|recommendTeacher" routes/recommendations.ts controllers/*.ts | head -20`
Identify where the existing `/api/recommendations/...` handlers live.

- [ ] **Step 2: Add consultant-scoped helpers to matchService**

In `server/services/matchService.ts`, append at the bottom of the file:

```ts
import ConsultantRoster from '../models/ConsultantRoster.js';
import TeacherProfile from '../models/TeacherProfile.js';
import Job from '../models/Job.js';

export async function recommendJobsForConsultantRoster(consultantAccountId: string, limit = 20) {
  const roster = await ConsultantRoster.find({
    consultantAccountId, entityType: 'teacher', status: 'active',
  });
  if (roster.length === 0) return [];
  const teacherIds = roster.map((r) => r.entityAccountId);
  const teachers = await TeacherProfile.find({ accountId: { $in: teacherIds } });
  if (teachers.length === 0) return [];

  const jobs = await Job.find({ status: 'active' }).limit(200);
  const scored = jobs.map((job) => {
    let bestScore = 0;
    let bestTeacherId: any = null;
    for (const t of teachers) {
      const s = scoreTeacherForJob(t, job);
      if (s > bestScore) { bestScore = s; bestTeacherId = t.accountId; }
    }
    return { job: job.toJSON ? job.toJSON() : job, score: bestScore, bestTeacherAccountId: bestTeacherId };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function recommendTeachersFromRosterForJob(consultantAccountId: string, jobId: string, limit = 20) {
  const job = await Job.findById(jobId);
  if (!job) return [];
  const roster = await ConsultantRoster.find({
    consultantAccountId, entityType: 'teacher', status: 'active',
  });
  if (roster.length === 0) return [];
  const teacherIds = roster.map((r) => r.entityAccountId);
  const teachers = await TeacherProfile.find({ accountId: { $in: teacherIds } });
  const scored = teachers.map((t) => ({
    teacher: t.toJSON(),
    score: scoreTeacherForJob(t, job),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
```

- [ ] **Step 3: Write the failing test**

Create `server/tests/integration/consultant-recommendations.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import recommendationRoutes from '../../routes/recommendations.js';
import rosterRoutes from '../../routes/roster.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Job from '../../models/Job.js';
import mongoose from 'mongoose';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api/roster', rosterRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'C', planType: 'consultant', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('GET /api/recommendations/jobs-for-roster', () => {
  it('returns top-scored jobs based on rostered teachers', async () => {
    const consSignup = await request(app).post('/api/auth/consultant/signup').send({
      name: 'C', email: `c-${Date.now()}@e.com`, password: 'pwpwpw',
      yearsOfExperience: 5, specializations: { subjects: [], levels: [], regions: [] },
    });
    const cookie = consSignup.headers['set-cookie'][0];

    const teachSignup = await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: `t-${Date.now()}@e.com`, password: 'pwpwpw',
      experience: 5, qualifications: ['B.Ed.'], subjects: ['Math', 'Physics'], location: 'Bengaluru',
    });
    const teacherId = teachSignup.body.data.account.id;
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: teacherId });

    await Job.create({
      title: 'Math Teacher', description: 'd',
      instituteId: new mongoose.Types.ObjectId(), instituteName: 'X',
      subjects: ['Math'], minimumExperience: 2, maximumExperience: 8,
      location: 'Bengaluru', salaryRange: { min: 30000, max: 50000 }, status: 'active',
    });

    const res = await request(app).get('/api/recommendations/jobs-for-roster').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].score).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd server && pnpm vitest run tests/integration/consultant-recommendations.test.ts`
Expected: FAIL — endpoint does not exist.

- [ ] **Step 5: Add handlers**

In the recommendations controller (located in Step 1), append:

```ts
import { recommendJobsForConsultantRoster, recommendTeachersFromRosterForJob } from '../services/matchService.js';

export const jobsForConsultantRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.account?.role !== 'consultant') {
    res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10)));
  const items = await recommendJobsForConsultantRoster(String(req.account.id), limit);
  res.status(200).json({ success: true, data: { items, total: items.length }, timestamp: new Date().toISOString() });
};

export const teachersForJobConsultant = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.account?.role !== 'consultant') {
    res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10)));
  const items = await recommendTeachersFromRosterForJob(String(req.account.id), req.params.jobId, limit);
  res.status(200).json({ success: true, data: { items, total: items.length }, timestamp: new Date().toISOString() });
};
```

In `server/routes/recommendations.ts`, append:

```ts
router.get('/jobs-for-roster', authenticate, jobsForConsultantRoster);
router.get('/teachers-for-job/:jobId', authenticate, teachersForJobConsultant);
```

(Import the two new handlers alongside any existing imports.)

- [ ] **Step 6: Run tests and verify they pass**

Run: `cd server && pnpm vitest run tests/integration/consultant-recommendations.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/services/matchService.ts server/controllers/ server/routes/recommendations.ts server/tests/integration/consultant-recommendations.test.ts
git commit -m "feat(recommendations): jobs-for-roster + teachers-for-job consultant endpoints"
```

---

# Phase 7 — UI types + services + AuthContext

### Task 20: Add UI types for consultant entities

**Files:**
- Modify: `src/api/types.ts`
- Modify: `src/types/profileGuards.ts`

- [ ] **Step 1: Extend AccountRole**

In `src/api/types.ts`, locate the `AccountRole` union type (or wherever roles are typed — grep `AccountRole`). Change:

```ts
export type AccountRole = 'institute' | 'teacher' | 'vendor' | 'admin' | 'marketing' | 'sales' | 'consultant';
```

- [ ] **Step 2: Add Consultant types**

Append to the same file:

```ts
export interface ConsultantProfile {
  id: string;
  accountId: string;
  agencyName?: string;
  registrationNumber?: string;
  yearsOfExperience: number;
  specializations: {
    subjects: string[];
    levels: string[];
    regions: string[];
  };
  bio?: string;
  website?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  verification?: {
    status: 'none' | 'pending' | 'verified' | 'rejected';
    verifiedAt?: string;
    verifiedBy?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConsultantSignupRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  agencyName?: string;
  registrationNumber?: string;
  yearsOfExperience: number;
  specializations: { subjects: string[]; levels: string[]; regions: string[] };
  bio?: string;
  website?: string;
}

export interface ConsultantRosterEntry {
  id: string;
  consultantAccountId: string;
  entityType: 'teacher' | 'institute';
  entityAccountId: string | { id: string; name: string; email: string; avatar?: string; role: string };
  status: 'active' | 'archived' | 'inactive';
  addedAt: string;
  archivedAt?: string;
  internalNotes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type InterviewMode = 'in_person' | 'video' | 'phone';
export type InterviewStatus = 'scheduled' | 'rescheduled' | 'completed' | 'canceled' | 'no_show';
export type InterviewOutcome = 'recommend_hire' | 'hold' | 'reject';

export interface Interview {
  id: string;
  applicationId: string;
  jobId: string;
  teacherAccountId: string;
  instituteAccountId: string;
  scheduledByAccountId: string;
  round: number;
  mode: InterviewMode;
  scheduledAt: string;
  durationMinutes: number;
  location?: string;
  meetingLink?: string;
  participants: string[];
  status: InterviewStatus;
  rescheduleReason?: string;
  notesBefore?: string;
  outcome?: InterviewOutcome;
  notesAfter?: string;
  consultantId?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlacementStage =
  | 'proposed' | 'applied' | 'interviewing' | 'offer_extended' | 'placed' | 'declined' | 'lost';

export interface Placement {
  id: string;
  consultantAccountId: string;
  teacherAccountId: string | { id: string; name: string; email: string; avatar?: string };
  jobId: string | { id: string; title: string; instituteName: string; location: string };
  applicationId?: string;
  stage: PlacementStage;
  agreedFee?: number;
  agreedFeeNotes?: string;
  stageHistory: Array<{
    stage: PlacementStage;
    changedAt: string;
    changedByAccountId: string;
    reason?: string;
  }>;
  lastActivityAt: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherConsultantConsent {
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  scope: 'any' | 'specific';
  allowedConsultantAccountIds?: string[];
}
```

- [ ] **Step 3: Extend `TeacherProfile` UI type**

In the same file, find the existing `TeacherProfile` interface and add (just before the closing `}`):

```ts
consultantConsent?: TeacherConsultantConsent;
```

- [ ] **Step 4: Extend `Application` UI type**

In the same file, find `Application` interface and add:

```ts
submittedByConsultantId?: string | { id: string; name: string; agencyName?: string };
```

- [ ] **Step 5: Add `isConsultantProfile` type guard**

In `src/types/profileGuards.ts`, append:

```ts
import type { ConsultantProfile } from '@/api/types';

export function isConsultantProfile(p: any, role?: string): p is ConsultantProfile {
  return role === 'consultant' && !!p && typeof p === 'object' && 'specializations' in p;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/api/types.ts src/types/profileGuards.ts
git commit -m "feat(types): consultant, roster, interview, placement UI types"
```

---

### Task 21: Add consultant API service files

**Files:**
- Create: `src/api/services/consultantService.ts`
- Create: `src/api/services/rosterService.ts`
- Create: `src/api/services/interviewService.ts`
- Create: `src/api/services/placementService.ts`
- Modify: `src/api/services/authService.ts`

- [ ] **Step 1: Write consultantService**

Create `src/api/services/consultantService.ts`:

```ts
import { apiClient } from '@/lib/apiClient';
import type { AuthBundle, ConsultantProfile } from '@/api/types';

export const consultantService = {
  async me(): Promise<AuthBundle> {
    return apiClient.get<AuthBundle>('/consultants/me');
  },
  async patchMe(updates: Partial<ConsultantProfile>): Promise<ConsultantProfile> {
    return apiClient.patch<ConsultantProfile>('/consultants/me', updates);
  },
  async getById(accountId: string): Promise<ConsultantProfile> {
    return apiClient.get<ConsultantProfile>(`/consultants/${accountId}`);
  },
  async recommendedJobs(limit = 20): Promise<{ items: Array<{ job: any; score: number; bestTeacherAccountId: string }>; total: number }> {
    return apiClient.get(`/recommendations/jobs-for-roster?limit=${limit}`);
  },
  async recommendedTeachersForJob(jobId: string, limit = 20): Promise<{ items: Array<{ teacher: any; score: number }>; total: number }> {
    return apiClient.get(`/recommendations/teachers-for-job/${jobId}?limit=${limit}`);
  },
};
```

- [ ] **Step 2: Write rosterService**

Create `src/api/services/rosterService.ts`:

```ts
import { apiClient } from '@/lib/apiClient';
import type { ConsultantRosterEntry, PaginatedResponse } from '@/api/types';

export const rosterService = {
  async list(params: { entityType?: 'teacher' | 'institute'; status?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResponse<ConsultantRosterEntry>> {
    const q = new URLSearchParams();
    if (params.entityType) q.set('entityType', params.entityType);
    if (params.status) q.set('status', params.status);
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 20));
    return apiClient.get<PaginatedResponse<ConsultantRosterEntry>>(`/roster?${q.toString()}`);
  },
  async create(input: { entityType: 'teacher' | 'institute'; entityAccountId: string; internalNotes?: string; tags?: string[] }): Promise<ConsultantRosterEntry> {
    return apiClient.post<ConsultantRosterEntry>('/roster', input);
  },
  async update(id: string, updates: Partial<ConsultantRosterEntry>): Promise<ConsultantRosterEntry> {
    return apiClient.patch<ConsultantRosterEntry>(`/roster/${id}`, updates);
  },
  async archive(id: string): Promise<ConsultantRosterEntry> {
    return apiClient.delete<ConsultantRosterEntry>(`/roster/${id}`);
  },
};
```

- [ ] **Step 3: Write interviewService**

Create `src/api/services/interviewService.ts`:

```ts
import { apiClient } from '@/lib/apiClient';
import type { Interview, InterviewMode, InterviewOutcome } from '@/api/types';

export const interviewService = {
  async list(params: { status?: string; from?: string; to?: string } = {}): Promise<{ items: Interview[]; total: number }> {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return apiClient.get(`/interviews?${q.toString()}`);
  },
  async get(id: string): Promise<Interview> {
    return apiClient.get<Interview>(`/interviews/${id}`);
  },
  async schedule(input: {
    applicationId: string;
    scheduledAt: string;
    durationMinutes: number;
    mode: InterviewMode;
    location?: string;
    meetingLink?: string;
    participants?: string[];
    notesBefore?: string;
    round?: number;
  }): Promise<Interview> {
    return apiClient.post<Interview>('/interviews', input);
  },
  async reschedule(id: string, scheduledAt: string, rescheduleReason?: string): Promise<Interview> {
    return apiClient.patch<Interview>(`/interviews/${id}`, { scheduledAt, rescheduleReason });
  },
  async complete(id: string, outcome: InterviewOutcome, notesAfter?: string): Promise<Interview> {
    return apiClient.patch<Interview>(`/interviews/${id}`, { outcome, notesAfter });
  },
  async cancel(id: string, reason?: string): Promise<Interview> {
    return apiClient.patch<Interview>(`/interviews/${id}`, { cancel: true, rescheduleReason: reason });
  },
};
```

- [ ] **Step 4: Write placementService**

Create `src/api/services/placementService.ts`:

```ts
import { apiClient } from '@/lib/apiClient';
import type { Placement, PlacementStage, PaginatedResponse } from '@/api/types';

export const placementService = {
  async list(params: { stage?: PlacementStage; page?: number; pageSize?: number } = {}): Promise<PaginatedResponse<Placement>> {
    const q = new URLSearchParams();
    if (params.stage) q.set('stage', params.stage);
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 20));
    return apiClient.get<PaginatedResponse<Placement>>(`/placements?${q.toString()}`);
  },
  async create(input: {
    teacherAccountId: string;
    jobId: string;
    applicationId?: string;
    initialStage?: PlacementStage;
    internalNotes?: string;
    agreedFee?: number;
  }): Promise<Placement> {
    return apiClient.post<Placement>('/placements', input);
  },
  async transition(id: string, stage: PlacementStage, reason?: string): Promise<Placement> {
    return apiClient.patch<Placement>(`/placements/${id}`, { stage, reason });
  },
  async patch(id: string, updates: Partial<Pick<Placement, 'internalNotes' | 'agreedFee' | 'agreedFeeNotes'>>): Promise<Placement> {
    return apiClient.patch<Placement>(`/placements/${id}`, updates);
  },
  async timeline(id: string): Promise<{ placement: Placement; stageHistory: Placement['stageHistory'] }> {
    return apiClient.get(`/placements/${id}/timeline`);
  },
};
```

- [ ] **Step 5: Extend authService for consultant signup**

In `src/api/services/authService.ts`, add to the imports:

```ts
import type { ConsultantSignupRequest } from '@/api/types';
```

Then add to the `authService` object (after `signupVendor`):

```ts
async signupConsultant(input: ConsultantSignupRequest): Promise<AuthBundle> {
  const result = await apiClient.post<BundleWithToken>('/auth/consultant/signup', input);
  persist(result);
  return result;
},
```

- [ ] **Step 6: Commit**

```bash
git add src/api/services/consultantService.ts src/api/services/rosterService.ts src/api/services/interviewService.ts src/api/services/placementService.ts src/api/services/authService.ts
git commit -m "feat(api): consultant + roster + interview + placement service clients"
```

---

### Task 22: Extend AuthContext with `signupConsultant`

**Files:**
- Modify: `src/context/AuthContext.tsx`

- [ ] **Step 1: Add imports**

In `src/context/AuthContext.tsx`, change the imports block to include `ConsultantSignupRequest`:

```ts
import type {
  Account,
  Profile,
  Subscription,
  InstituteSignupRequest,
  TeacherSignupRequest,
  VendorSignupRequest,
  ConsultantSignupRequest,
} from '@/api/types';
```

- [ ] **Step 2: Extend context type**

In the `AuthContextType` interface, add (next to the other signup methods):

```ts
signupConsultant: (input: ConsultantSignupRequest) => Promise<void>;
```

- [ ] **Step 3: Implement the method**

After `signupVendor` is defined (after the `signupVendor` `useCallback` block), add:

```ts
const signupConsultant = useCallback(
  async (input: ConsultantSignupRequest) => {
    setIsLoading(true);
    try {
      const bundle = await authService.signupConsultant(input);
      applyBundle(bundle);
      toast.success('Consultant signup successful');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Signup failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  },
  [applyBundle],
);
```

- [ ] **Step 4: Export the method in provider value**

In the `<AuthContext.Provider value={{ ... }}>` block, add `signupConsultant,` next to the other signup methods.

- [ ] **Step 5: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "feat(auth-context): signupConsultant method"
```

---

# Phase 8 — Consultant UI pages

### Task 23: ConsultantSignup page

**Files:**
- Create: `src/pages/ConsultantSignup.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the page**

Create `src/pages/ConsultantSignup.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ConsultantSignup() {
  const navigate = useNavigate();
  const { signupConsultant } = useAuth();

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '', phone: '',
    agencyName: '', registrationNumber: '',
    yearsOfExperience: '5',
    subjects: '', levels: '', regions: '',
    bio: '', website: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.name.trim()) next.name = 'Name required';
    if (!EMAIL_REGEX.test(formData.email)) next.email = 'Valid email required';
    if (formData.password.length < 6) next.password = 'Min 6 chars';
    if (formData.password !== formData.confirmPassword) next.confirmPassword = 'Passwords mismatch';
    const yrs = parseInt(formData.yearsOfExperience, 10);
    if (Number.isNaN(yrs) || yrs < 0) next.yearsOfExperience = 'Enter a number';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const toList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signupConsultant({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        agencyName: formData.agencyName || undefined,
        registrationNumber: formData.registrationNumber || undefined,
        yearsOfExperience: parseInt(formData.yearsOfExperience, 10),
        specializations: { subjects: toList(formData.subjects), levels: toList(formData.levels), regions: toList(formData.regions) },
        bio: formData.bio || undefined,
        website: formData.website || undefined,
      });
      navigate('/consultant/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Job Consultant Signup</CardTitle>
          <CardDescription>
            Join eduFleet as a placement consultant to broker teacher hires.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Name</Label><Input name="name" value={formData.name} onChange={handleChange} />{errors.name && <p className="text-xs text-destructive">{errors.name}</p>}</div>
              <div><Label>Email</Label><Input name="email" type="email" value={formData.email} onChange={handleChange} />{errors.email && <p className="text-xs text-destructive">{errors.email}</p>}</div>
              <div><Label>Password</Label><Input name="password" type="password" value={formData.password} onChange={handleChange} />{errors.password && <p className="text-xs text-destructive">{errors.password}</p>}</div>
              <div><Label>Confirm Password</Label><Input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} />{errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}</div>
              <div><Label>Phone</Label><Input name="phone" value={formData.phone} onChange={handleChange} /></div>
              <div><Label>Years of Experience</Label><Input name="yearsOfExperience" type="number" value={formData.yearsOfExperience} onChange={handleChange} />{errors.yearsOfExperience && <p className="text-xs text-destructive">{errors.yearsOfExperience}</p>}</div>
              <div><Label>Agency Name (optional)</Label><Input name="agencyName" value={formData.agencyName} onChange={handleChange} /></div>
              <div><Label>Registration Number (optional)</Label><Input name="registrationNumber" value={formData.registrationNumber} onChange={handleChange} /></div>
            </div>
            <div><Label>Specialization — Subjects (comma-separated)</Label><Input name="subjects" value={formData.subjects} onChange={handleChange} placeholder="Math, Physics" /></div>
            <div><Label>Specialization — Levels (comma-separated)</Label><Input name="levels" value={formData.levels} onChange={handleChange} placeholder="Primary, Secondary" /></div>
            <div><Label>Specialization — Regions (comma-separated)</Label><Input name="regions" value={formData.regions} onChange={handleChange} placeholder="Bengaluru, Mysore" /></div>
            <div><Label>Website (optional)</Label><Input name="website" value={formData.website} onChange={handleChange} /></div>
            <div><Label>Bio (optional)</Label><Textarea name="bio" value={formData.bio} onChange={handleChange} rows={3} /></div>
            <Button type="submit" disabled={submitting} className="w-full">{submitting ? 'Signing up…' : 'Create Consultant Account'}</Button>
            <p className="text-sm text-center">Already have an account? <Link to="/login" className="underline">Log in</Link></p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConsultantSignup;
```

- [ ] **Step 2: Register route in App.tsx**

In `src/App.tsx`, in the imports block add:

```ts
import { ConsultantSignup } from '@/pages/ConsultantSignup';
```

And in the public-routes block (after `<Route path="/vendor/signup" element={<VendorSignup />} />`), add:

```tsx
<Route path="/consultant/signup" element={<ConsultantSignup />} />
```

- [ ] **Step 3: Manual smoke**

Run the dev server and open `/consultant/signup`. Fill the form and confirm it lands on `/consultant/dashboard` (placeholder route, will 404 until Task 24).

- [ ] **Step 4: Commit**

```bash
git add src/pages/ConsultantSignup.tsx src/App.tsx
git commit -m "feat(ui): consultant signup page"
```

---

### Task 24: ConsultantDashboard page

**Files:**
- Create: `src/pages/ConsultantDashboard.tsx`
- Create: `src/components/PlacementCard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the PlacementCard**

Create `src/components/PlacementCard.tsx`:

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { placementService } from '@/api/services/placementService';
import type { Placement, PlacementStage } from '@/api/types';
import { toast } from 'sonner';

const ALLOWED_NEXT: Record<PlacementStage, PlacementStage[]> = {
  proposed:       ['applied', 'lost'],
  applied:        ['interviewing', 'declined', 'lost'],
  interviewing:   ['offer_extended', 'declined', 'lost'],
  offer_extended: ['placed', 'declined', 'lost'],
  placed: [], declined: [], lost: [],
};

const STAGE_LABEL: Record<PlacementStage, string> = {
  proposed: 'Proposed', applied: 'Applied', interviewing: 'Interviewing',
  offer_extended: 'Offer Extended', placed: 'Placed', declined: 'Declined', lost: 'Lost',
};

interface Props {
  placement: Placement;
  onChange?: () => void;
}

export function PlacementCard({ placement, onChange }: Props) {
  const next = ALLOWED_NEXT[placement.stage];
  const teacher = typeof placement.teacherAccountId === 'string' ? null : placement.teacherAccountId;
  const job = typeof placement.jobId === 'string' ? null : placement.jobId;

  const handleTransition = async (to: PlacementStage) => {
    try {
      await placementService.transition(placement.id, to);
      toast.success(`Moved to ${STAGE_LABEL[to]}`);
      onChange?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to transition');
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{teacher?.name ?? 'Teacher'}</p>
            <p className="text-xs text-muted-foreground truncate">{job?.title ?? 'Job'} · {job?.instituteName ?? ''}</p>
          </div>
          <Badge variant="outline">{STAGE_LABEL[placement.stage]}</Badge>
        </div>
        {next.length > 0 && (
          <Select onValueChange={(v) => handleTransition(v as PlacementStage)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Move to…" /></SelectTrigger>
            <SelectContent>
              {next.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Write the dashboard page**

Create `src/pages/ConsultantDashboard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { rosterService } from '@/api/services/rosterService';
import { placementService } from '@/api/services/placementService';
import { interviewService } from '@/api/services/interviewService';
import { consultantService } from '@/api/services/consultantService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PlacementCard } from '@/components/PlacementCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { Placement, PlacementStage, Interview, ConsultantRosterEntry } from '@/api/types';

const KANBAN_STAGES: PlacementStage[] = ['proposed', 'applied', 'interviewing', 'offer_extended', 'placed'];

export function ConsultantDashboard() {
  const { account } = useAuth();
  const [loading, setLoading] = useState(true);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [rosterTeachers, setRosterTeachers] = useState<ConsultantRosterEntry[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<Array<{ job: any; score: number; bestTeacherAccountId: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const weekAhead = new Date(now.getTime() + 7 * 86400000);
      const [pl, iv, rt, rec] = await Promise.all([
        placementService.list({ pageSize: 100 }),
        interviewService.list({ status: 'scheduled', from: now.toISOString(), to: weekAhead.toISOString() }),
        rosterService.list({ entityType: 'teacher', pageSize: 100 }),
        consultantService.recommendedJobs(6).catch(() => ({ items: [], total: 0 })),
      ]);
      setPlacements(pl.items);
      setInterviews(iv.items);
      setRosterTeachers(rt.items);
      setRecommendedJobs(rec.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const byStage = (s: PlacementStage) => placements.filter((p) => p.stage === s);
  const placedThisMonth = placements.filter((p) => {
    if (p.stage !== 'placed') return false;
    const placedAt = new Date(p.lastActivityAt);
    const now = new Date();
    return placedAt.getMonth() === now.getMonth() && placedAt.getFullYear() === now.getFullYear();
  }).length;

  if (loading) {
    return <div className="container mx-auto p-4 space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Consultant Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome, {account?.name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader><CardTitle className="text-sm">Roster Teachers</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{rosterTeachers.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Active Placements</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{placements.filter((p) => ['proposed','applied','interviewing','offer_extended'].includes(p.stage)).length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Interviews (next 7d)</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{interviews.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Placed This Month</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{placedThisMonth}</CardContent></Card>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Pipeline</h2>
          <Link to="/consultant/placements" className="text-sm underline">View all</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto">
          {KANBAN_STAGES.map((stage) => (
            <div key={stage} className="space-y-2 min-w-[180px]">
              <div className="text-xs font-medium text-muted-foreground capitalize">{stage.replace('_', ' ')} ({byStage(stage).length})</div>
              {byStage(stage).slice(0, 4).map((p) => <PlacementCard key={p.id} placement={p} onChange={load} />)}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recommended jobs for your roster</h2>
          <Link to="/consultant/jobs" className="text-sm underline">Browse all jobs</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recommendedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full py-8 text-center">Add teachers to your roster to see job recommendations.</p>
          ) : (
            recommendedJobs.map((r) => (
              <Link key={r.job.id ?? r.job._id} to={`/consultant/jobs/${r.job.id ?? r.job._id}`}>
                <Card className="hover:shadow-md transition-shadow"><CardContent className="p-3">
                  <p className="font-semibold text-sm">{r.job.title}</p>
                  <p className="text-xs text-muted-foreground">{r.job.instituteName} · {r.job.location}</p>
                  <p className="text-xs mt-1">Match score: <strong>{(r.score * 100).toFixed(0)}%</strong></p>
                </CardContent></Card>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default ConsultantDashboard;
```

- [ ] **Step 3: Register route**

In `src/App.tsx`, import:

```ts
import { ConsultantDashboard } from '@/pages/ConsultantDashboard';
```

And add inside the authenticated-routes block:

```tsx
<Route path="/consultant/dashboard" element={
  <ProtectedRoute requiredRole="consultant">
    <ConsultantDashboard />
  </ProtectedRoute>
} />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PlacementCard.tsx src/pages/ConsultantDashboard.tsx src/App.tsx
git commit -m "feat(ui): consultant dashboard with kanban + recommendations"
```

---

### Task 25: ConsultantRoster page + AddToRosterDialog

**Files:**
- Create: `src/pages/ConsultantRoster.tsx`
- Create: `src/components/AddToRosterDialog.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write AddToRosterDialog**

Create `src/components/AddToRosterDialog.tsx`:

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/apiClient';
import { rosterService } from '@/api/services/rosterService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'teacher' | 'institute';
  onAdded?: () => void;
}

export function AddToRosterDialog({ open, onOpenChange, entityType, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    const endpoint = entityType === 'teacher' ? '/teachers/search' : '/institutes/search';
    try {
      const data = await apiClient.get<{ items: any[] }>(`${endpoint}?q=${encodeURIComponent(query)}&pageSize=10`);
      setResults((data.items ?? []).map((a) => ({ id: a.accountId ?? a.id, name: a.name ?? a.instituteName ?? '', email: a.email ?? '' })));
    } catch (e: any) {
      toast.error(e?.message ?? 'Search failed');
    }
  };

  const handleAdd = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await rosterService.create({
        entityType,
        entityAccountId: selected,
        internalNotes: notes || undefined,
        tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
      toast.success('Added to roster');
      onAdded?.();
      onOpenChange(false);
      setQuery(''); setResults([]); setSelected(null); setNotes(''); setTagsRaw('');
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to add';
      if (/duplicate|already/i.test(msg)) toast.info('Already in your roster.');
      else toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {entityType} to roster</DialogTitle>
          <DialogDescription>Search by name or email, then add internal notes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${entityType}s by name/email`} onKeyDown={(e) => e.key === 'Enter' && search()} />
            <Button type="button" onClick={search}>Search</Button>
          </div>
          {results.length > 0 && (
            <ul className="border rounded divide-y max-h-48 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    className={`w-full text-left p-2 text-sm hover:bg-muted ${selected === r.id ? 'bg-muted' : ''}`}
                  >
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div><Label>Internal notes (optional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div><Label>Tags (comma-separated, optional)</Label><Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="priority, remote-ok" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!selected || submitting}>{submitting ? 'Adding…' : 'Add to roster'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

(NOTE: this assumes a `/teachers/search` and `/institutes/search` endpoint exist. If they don't, swap to the existing search endpoint used in `InstituteTeacherSearch.tsx` — confirm with `grep -n "/teachers" src/api/services/*.ts`.)

- [ ] **Step 2: Write ConsultantRoster page**

Create `src/pages/ConsultantRoster.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AddToRosterDialog } from '@/components/AddToRosterDialog';
import { rosterService } from '@/api/services/rosterService';
import type { ConsultantRosterEntry } from '@/api/types';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

export function ConsultantRoster() {
  const [tab, setTab] = useState<'teacher' | 'institute'>('teacher');
  const [items, setItems] = useState<ConsultantRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await rosterService.list({ entityType: tab, status: 'active', pageSize: 100 });
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const handleArchive = async (id: string) => {
    try {
      await rosterService.archive(id);
      toast.success('Archived');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed');
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roster</h1>
        <Button onClick={() => setDialogOpen(true)}>Add {tab}</Button>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'teacher' | 'institute')}>
        <TabsList>
          <TabsTrigger value="teacher">Teachers</TabsTrigger>
          <TabsTrigger value="institute">Institutes</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No active {tab}s in your roster.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((entry) => {
                const target = typeof entry.entityAccountId === 'string' ? null : entry.entityAccountId;
                return (
                  <Card key={entry.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{target?.name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground truncate">{target?.email ?? ''}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleArchive(entry.id)} aria-label="Archive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.map((t) => <span key={t} className="text-xs px-2 py-0.5 bg-muted rounded">{t}</span>)}
                        </div>
                      )}
                      {entry.internalNotes && <p className="text-xs text-muted-foreground line-clamp-2">{entry.internalNotes}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <AddToRosterDialog open={dialogOpen} onOpenChange={setDialogOpen} entityType={tab} onAdded={load} />
    </div>
  );
}

export default ConsultantRoster;
```

- [ ] **Step 3: Register route**

In `src/App.tsx`, add:

```tsx
<Route path="/consultant/roster" element={
  <ProtectedRoute requiredRole="consultant">
    <ConsultantRoster />
  </ProtectedRoute>
} />
```

And import `ConsultantRoster`.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddToRosterDialog.tsx src/pages/ConsultantRoster.tsx src/App.tsx
git commit -m "feat(ui): consultant roster page with add/archive"
```

---

### Task 26: ConsultantPlacements + ConsultantInterviews + InterviewScheduler

**Files:**
- Create: `src/components/InterviewScheduler.tsx`
- Create: `src/pages/ConsultantPlacements.tsx`
- Create: `src/pages/ConsultantInterviews.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write InterviewScheduler**

Create `src/components/InterviewScheduler.tsx`:

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { interviewService } from '@/api/services/interviewService';
import type { InterviewMode } from '@/api/types';
import { toast } from 'sonner';

interface Props {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
}

export function InterviewScheduler({ applicationId, open, onOpenChange, onScheduled }: Props) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [mode, setMode] = useState<InterviewMode>('video');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notesBefore, setNotesBefore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!scheduledAt) { toast.error('Please pick a date/time'); return; }
    setSubmitting(true);
    try {
      await interviewService.schedule({
        applicationId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes,
        mode,
        location: mode === 'in_person' ? location : undefined,
        meetingLink: mode === 'video' ? meetingLink : undefined,
        notesBefore: notesBefore || undefined,
      });
      toast.success('Interview scheduled — participants notified');
      onScheduled?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription>Teacher and institute will be notified automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Date & time</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
          <div><Label>Duration (minutes)</Label><Input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 30)} min={5} /></div>
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as InterviewMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="in_person">In-person</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'video' && <div><Label>Meeting link</Label><Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet…" /></div>}
          {mode === 'in_person' && <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>}
          <div><Label>Notes (optional)</Label><Textarea value={notesBefore} onChange={(e) => setNotesBefore(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Scheduling…' : 'Schedule'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write ConsultantPlacements page**

Create `src/pages/ConsultantPlacements.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { placementService } from '@/api/services/placementService';
import { PlacementCard } from '@/components/PlacementCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Placement, PlacementStage } from '@/api/types';

const STAGES: PlacementStage[] = ['proposed', 'applied', 'interviewing', 'offer_extended', 'placed', 'declined', 'lost'];

export function ConsultantPlacements() {
  const [items, setItems] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<PlacementStage | 'all'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const filter = stage === 'all' ? {} : { stage };
      const res = await placementService.list({ ...filter, pageSize: 100 });
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [stage]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Placements</h1>
      <Tabs value={stage} onValueChange={(v) => setStage(v as any)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          {STAGES.map((s) => <TabsTrigger key={s} value={s}>{s.replace('_', ' ')}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={stage} className="mt-4">
          {loading ? <Skeleton className="h-32" /> :
            items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">No placements at this stage.</p> :
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((p) => <PlacementCard key={p.id} placement={p} onChange={load} />)}
            </div>
          }
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ConsultantPlacements;
```

- [ ] **Step 3: Write ConsultantInterviews page**

Create `src/pages/ConsultantInterviews.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { interviewService } from '@/api/services/interviewService';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Interview } from '@/api/types';

export function ConsultantInterviews() {
  const [items, setItems] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await interviewService.list({});
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleCancel = async (id: string) => {
    try { await interviewService.cancel(id, 'Canceled by consultant'); toast.success('Canceled'); load(); }
    catch (e: any) { toast.error(e?.message ?? 'Failed'); }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Interviews</h1>
      {loading ? <Skeleton className="h-32" /> :
        items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">No interviews scheduled.</p> :
        <div className="space-y-3">
          {items.map((iv) => (
            <Card key={iv.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold">Round {iv.round} · {iv.mode.replace('_', '-')}</p>
                  <p className="text-sm text-muted-foreground">{new Date(iv.scheduledAt).toLocaleString()}</p>
                  {iv.meetingLink && <a href={iv.meetingLink} target="_blank" rel="noreferrer" className="text-xs underline">Open meeting link</a>}
                  {iv.location && <p className="text-xs">📍 {iv.location}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{iv.status}</Badge>
                  {iv.status === 'scheduled' && <Button size="sm" variant="ghost" onClick={() => handleCancel(iv.id)}>Cancel</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      }
    </div>
  );
}

export default ConsultantInterviews;
```

- [ ] **Step 4: Register routes**

In `src/App.tsx`, import and add inside protected block:

```ts
import { ConsultantPlacements } from '@/pages/ConsultantPlacements';
import { ConsultantInterviews } from '@/pages/ConsultantInterviews';
```

```tsx
<Route path="/consultant/placements" element={<ProtectedRoute requiredRole="consultant"><ConsultantPlacements /></ProtectedRoute>} />
<Route path="/consultant/interviews" element={<ProtectedRoute requiredRole="consultant"><ConsultantInterviews /></ProtectedRoute>} />
```

- [ ] **Step 5: Commit**

```bash
git add src/components/InterviewScheduler.tsx src/pages/ConsultantPlacements.tsx src/pages/ConsultantInterviews.tsx src/App.tsx
git commit -m "feat(ui): consultant placements + interviews pages"
```

---

### Task 27: ConsultantJobSearch + ConsultantTeacherSearch + ProposeMatchesDialog

**Files:**
- Create: `src/components/ProposeMatchesDialog.tsx`
- Create: `src/pages/ConsultantJobSearch.tsx`
- Create: `src/pages/ConsultantTeacherSearch.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write ProposeMatchesDialog**

Create `src/components/ProposeMatchesDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { consultantService } from '@/api/services/consultantService';
import { placementService } from '@/api/services/placementService';
import { toast } from 'sonner';

interface Props {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProposed?: () => void;
}

export function ProposeMatchesDialog({ jobId, open, onOpenChange, onProposed }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Array<{ teacher: any; score: number }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    consultantService.recommendedTeachersForJob(jobId, 20)
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, [open, jobId]);

  const handlePropose = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) { toast.error('Select at least one teacher'); return; }
    setSubmitting(true);
    let ok = 0, dup = 0, fail = 0;
    for (const teacherAccountId of ids) {
      try {
        await placementService.create({ teacherAccountId, jobId, initialStage: 'proposed' });
        ok++;
      } catch (e: any) {
        if (/duplicate|already/i.test(e?.message ?? '')) dup++;
        else fail++;
      }
    }
    setSubmitting(false);
    toast.success(`Proposed ${ok}${dup ? `, ${dup} already pending` : ''}${fail ? `, ${fail} failed` : ''}`);
    onProposed?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose teachers to this job</DialogTitle>
          <DialogDescription>Top matches from your roster, ranked by skill-match score.</DialogDescription>
        </DialogHeader>
        {loading ? <Skeleton className="h-32" /> :
          items.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No rostered teachers match this job.</p> :
          <ul className="divide-y max-h-72 overflow-y-auto">
            {items.map((it) => {
              const id = String(it.teacher.accountId ?? it.teacher.id);
              return (
                <li key={id} className="py-2 flex items-center gap-3">
                  <Checkbox checked={!!selected[id]} onCheckedChange={(v) => setSelected((p) => ({ ...p, [id]: !!v }))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.teacher.name ?? id}</p>
                    <p className="text-xs text-muted-foreground">Match: {(it.score * 100).toFixed(0)}%</p>
                  </div>
                </li>
              );
            })}
          </ul>
        }
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handlePropose} disabled={submitting}>{submitting ? 'Proposing…' : 'Propose selected'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write ConsultantJobSearch**

Create `src/pages/ConsultantJobSearch.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ProposeMatchesDialog } from '@/components/ProposeMatchesDialog';

export function ConsultantJobSearch() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50', status: 'active' });
      if (q) params.set('q', q);
      const data = await apiClient.get<{ items: any[] }>(`/jobs?${params.toString()}`);
      setItems(data.items ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Jobs</h1>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by subject, location, title" onKeyDown={(e) => e.key === 'Enter' && load()} />
        <Button onClick={load}>Search</Button>
      </div>
      {loading ? <Skeleton className="h-64" /> :
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((j) => (
            <Card key={j.id ?? j._id}>
              <CardContent className="p-4 space-y-2">
                <p className="font-semibold">{j.title}</p>
                <p className="text-xs text-muted-foreground">{j.instituteName} · {j.location}</p>
                <p className="text-xs">{j.subjects?.join(', ')}</p>
                <Button size="sm" className="w-full" onClick={() => setSelectedJob(j.id ?? j._id)}>Propose from roster</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      }
      {selectedJob && (
        <ProposeMatchesDialog
          jobId={selectedJob}
          open={!!selectedJob}
          onOpenChange={(o) => !o && setSelectedJob(null)}
        />
      )}
    </div>
  );
}

export default ConsultantJobSearch;
```

- [ ] **Step 3: Write ConsultantTeacherSearch**

Create `src/pages/ConsultantTeacherSearch.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { rosterService } from '@/api/services/rosterService';
import { toast } from 'sonner';

export function ConsultantTeacherSearch() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (q) params.set('q', q);
      const data = await apiClient.get<{ items: any[] }>(`/teachers?${params.toString()}`);
      setItems(data.items ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addToRoster = async (accountId: string) => {
    try { await rosterService.create({ entityType: 'teacher', entityAccountId: accountId }); toast.success('Added to roster'); }
    catch (e: any) {
      const m = e?.message ?? 'Failed';
      if (/duplicate|already/i.test(m)) toast.info('Already in your roster.');
      else toast.error(m);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Teachers</h1>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teachers by subject, location" onKeyDown={(e) => e.key === 'Enter' && load()} />
        <Button onClick={load}>Search</Button>
      </div>
      {loading ? <Skeleton className="h-64" /> :
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((t) => (
            <Card key={t.id ?? t.accountId}>
              <CardContent className="p-4 space-y-2">
                <p className="font-semibold">{t.name ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{t.subjects?.join(', ')} · {t.experience} yrs</p>
                <p className="text-xs">{t.location}</p>
                <Button size="sm" className="w-full" onClick={() => addToRoster(t.accountId ?? t.id)}>Add to roster</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      }
    </div>
  );
}

export default ConsultantTeacherSearch;
```

- [ ] **Step 4: Register routes**

In `src/App.tsx`, import and add:

```ts
import { ConsultantJobSearch } from '@/pages/ConsultantJobSearch';
import { ConsultantTeacherSearch } from '@/pages/ConsultantTeacherSearch';
```

```tsx
<Route path="/consultant/jobs" element={<ProtectedRoute requiredRole="consultant"><ConsultantJobSearch /></ProtectedRoute>} />
<Route path="/consultant/teachers" element={<ProtectedRoute requiredRole="consultant"><ConsultantTeacherSearch /></ProtectedRoute>} />
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ProposeMatchesDialog.tsx src/pages/ConsultantJobSearch.tsx src/pages/ConsultantTeacherSearch.tsx src/App.tsx
git commit -m "feat(ui): consultant job + teacher search with propose-from-roster"
```

---

# Phase 9 — UI cross-persona touches

### Task 28: Header consultant nav + ConsultantBadge in Institute applications

**Files:**
- Create: `src/components/ConsultantBadge.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/pages/InstituteJobApplications.tsx`

- [ ] **Step 1: Write ConsultantBadge**

Create `src/components/ConsultantBadge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { Briefcase } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  consultant: { name?: string; agencyName?: string; phone?: string; email?: string } | string;
}

export function ConsultantBadge({ consultant }: Props) {
  if (typeof consultant === 'string') {
    return <Badge variant="outline" className="ml-1 gap-1"><Briefcase className="w-3 h-3" />via Consultant</Badge>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge variant="outline" className="ml-1 gap-1 cursor-pointer">
          <Briefcase className="w-3 h-3" />via {consultant.agencyName ?? consultant.name ?? 'Consultant'}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <p className="font-semibold text-sm">{consultant.name}</p>
        {consultant.agencyName && <p className="text-xs text-muted-foreground">{consultant.agencyName}</p>}
        {consultant.email && <p className="text-xs mt-1">{consultant.email}</p>}
        {consultant.phone && <p className="text-xs">{consultant.phone}</p>}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Add consultant nav block to Header**

In `src/components/Header.tsx`, find the role-conditional nav block (grep for `account.role === 'institute'` or similar). Add a parallel block for `consultant`. Example insertion (right after the institute block):

```tsx
{account?.role === 'consultant' && (
  <>
    <Link to="/consultant/dashboard" className="hover:text-primary">Dashboard</Link>
    <Link to="/consultant/roster" className="hover:text-primary">Roster</Link>
    <Link to="/consultant/jobs" className="hover:text-primary">Jobs</Link>
    <Link to="/consultant/teachers" className="hover:text-primary">Teachers</Link>
    <Link to="/consultant/placements" className="hover:text-primary">Pipeline</Link>
    <Link to="/consultant/interviews" className="hover:text-primary">Interviews</Link>
  </>
)}
```

Apply the same insertion inside the mobile drawer/menu block if there is a separate mobile nav.

- [ ] **Step 3: Render ConsultantBadge in InstituteJobApplications**

In `src/pages/InstituteJobApplications.tsx`, find where the teacher's name is rendered for each application. Wrap or follow it with:

```tsx
import { ConsultantBadge } from '@/components/ConsultantBadge';

// inside the application row, next to teacherName:
{application.submittedByConsultantId && (
  <ConsultantBadge consultant={application.submittedByConsultantId as any} />
)}
```

(If the application list endpoint doesn't populate `submittedByConsultantId` yet, update the server's institute-applications controller to `.populate('submittedByConsultantId', 'name email phone')` AND join the ConsultantProfile for `agencyName`. Track that as Task 28b if needed.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ConsultantBadge.tsx src/components/Header.tsx src/pages/InstituteJobApplications.tsx
git commit -m "feat(ui): consultant nav block + consultant badge on institute applications"
```

---

### Task 29: TeacherConsentToggle widget on TeacherDashboard

**Files:**
- Create: `src/components/TeacherConsentToggle.tsx`
- Modify: `src/pages/TeacherDashboard.tsx`

- [ ] **Step 1: Write TeacherConsentToggle**

Create `src/components/TeacherConsentToggle.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import type { TeacherConsultantConsent } from '@/api/types';
import { useAuth } from '@/context/AuthContext';

export function TeacherConsentToggle() {
  const { profile } = useAuth();
  const [consent, setConsent] = useState<TeacherConsultantConsent>({
    granted: (profile as any)?.consultantConsent?.granted ?? false,
    scope: (profile as any)?.consultantConsent?.scope ?? 'any',
  });

  useEffect(() => {
    setConsent({
      granted: (profile as any)?.consultantConsent?.granted ?? false,
      scope: (profile as any)?.consultantConsent?.scope ?? 'any',
    });
  }, [profile]);

  const handleToggle = async (granted: boolean) => {
    try {
      const updated = await apiClient.patch<any>('/teachers/me/consultant-consent', { granted, scope: 'any' });
      setConsent({
        granted: updated.consultantConsent.granted,
        scope: updated.consultantConsent.scope,
      });
      toast.success(granted ? 'Consultants can now apply on your behalf' : 'Consultant access revoked');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consultant Representation</CardTitle>
        <CardDescription>Allow placement consultants to apply for jobs on your behalf.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Switch id="consent" checked={consent.granted} onCheckedChange={handleToggle} />
          <Label htmlFor="consent">{consent.granted ? 'Consultants may apply on your behalf' : 'Off — only you can apply'}</Label>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          You can revoke this anytime. Revoking cancels pending consultant-submitted applications still in the "proposed" stage.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Mount on TeacherDashboard**

In `src/pages/TeacherDashboard.tsx`, import and render the widget in the profile/settings area:

```tsx
import { TeacherConsentToggle } from '@/components/TeacherConsentToggle';

// inside the dashboard JSX, in the profile/settings section:
<TeacherConsentToggle />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TeacherConsentToggle.tsx src/pages/TeacherDashboard.tsx
git commit -m "feat(teacher): consultant representation consent toggle"
```

---

# Phase 10 — Admin

### Task 30: Admin Consultant + Placement management pages

**Files:**
- Create: `src/pages/admin/ConsultantManagement.tsx`
- Create: `src/pages/admin/PlacementManagement.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AdminSidebar.tsx`
- Create: `server/routes/admin.ts` (extend existing) — add admin endpoints
- Modify: `server/controllers/` — add admin handlers

- [ ] **Step 1: Add admin server endpoints**

In `server/routes/admin.ts` (locate via grep `admin`), add two new GET routes (authenticated + role admin):

```ts
router.get('/consultants', authenticate, requireRole('admin'), adminListConsultants);
router.get('/placements', authenticate, requireRole('admin'), adminListPlacements);
```

In the corresponding controller file, add:

```ts
import ConsultantProfile from '../models/ConsultantProfile.js';
import Placement from '../models/Placement.js';

export const adminListConsultants = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)));
  const items = await ConsultantProfile.find({})
    .populate('accountId', 'name email avatar isActive isVerified')
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);
  const total = await ConsultantProfile.countDocuments({});
  res.status(200).json({ success: true, data: { items: items.map((i) => i.toJSON()), total, page, pageSize, hasMore: page * pageSize < total }, timestamp: new Date().toISOString() });
};

export const adminListPlacements = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)));
  const filter: any = {};
  if (req.query.consultantId) filter.consultantAccountId = req.query.consultantId;
  if (req.query.stage) filter.stage = req.query.stage;
  const items = await Placement.find(filter)
    .populate('consultantAccountId', 'name email')
    .populate('teacherAccountId', 'name email')
    .populate('jobId', 'title instituteName')
    .sort({ lastActivityAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);
  const total = await Placement.countDocuments(filter);
  res.status(200).json({ success: true, data: { items: items.map((i) => i.toJSON()), total, page, pageSize, hasMore: page * pageSize < total }, timestamp: new Date().toISOString() });
};
```

- [ ] **Step 2: Write ConsultantManagement page**

Create `src/pages/admin/ConsultantManagement.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function ConsultantManagement() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<{ items: any[] }>('/admin/consultants?pageSize=100')
      .then((r) => setItems(r.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Consultant Management</h1>
      {loading ? <Skeleton className="h-64" /> :
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => {
            const acct = typeof c.accountId === 'string' ? null : c.accountId;
            return (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{acct?.name ?? '—'}</p>
                    <Badge variant={c.verification?.status === 'verified' ? 'default' : 'outline'}>
                      {c.verification?.status ?? 'none'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{acct?.email}</p>
                  {c.agencyName && <p className="text-xs">{c.agencyName}</p>}
                  <p className="text-xs">{c.yearsOfExperience} yrs · {c.specializations?.subjects?.join(', ')}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      }
    </div>
  );
}

export default ConsultantManagement;
```

- [ ] **Step 3: Write PlacementManagement page**

Create `src/pages/admin/PlacementManagement.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function PlacementManagement() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<{ items: any[] }>('/admin/placements?pageSize=100')
      .then((r) => setItems(r.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Placement Pipeline (admin)</h1>
      {loading ? <Skeleton className="h-64" /> :
        <div className="space-y-2">
          {items.map((p) => {
            const cons = typeof p.consultantAccountId === 'string' ? null : p.consultantAccountId;
            const teacher = typeof p.teacherAccountId === 'string' ? null : p.teacherAccountId;
            const job = typeof p.jobId === 'string' ? null : p.jobId;
            return (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <strong>{teacher?.name ?? '—'}</strong> → <strong>{job?.title ?? '—'}</strong> ({job?.instituteName ?? ''})
                    </p>
                    <p className="text-xs text-muted-foreground">Consultant: {cons?.name ?? cons?.email ?? '—'}</p>
                  </div>
                  <Badge variant="outline">{p.stage}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      }
    </div>
  );
}

export default PlacementManagement;
```

- [ ] **Step 4: Register admin routes**

In `src/App.tsx`, import and add inside the admin routes block:

```ts
import { ConsultantManagement } from '@/pages/admin/ConsultantManagement';
import { PlacementManagement } from '@/pages/admin/PlacementManagement';
```

```tsx
<Route path="/admin/consultants" element={<ProtectedRoute requiredRole="admin"><ConsultantManagement /></ProtectedRoute>} />
<Route path="/admin/placements" element={<ProtectedRoute requiredRole="admin"><PlacementManagement /></ProtectedRoute>} />
```

- [ ] **Step 5: Add to AdminSidebar nav**

In `src/components/AdminSidebar.tsx`, add two new nav items (following the existing pattern):

```tsx
{ to: '/admin/consultants', label: 'Consultants' },
{ to: '/admin/placements', label: 'Placements' },
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/admin.ts server/controllers/ src/pages/admin/ConsultantManagement.tsx src/pages/admin/PlacementManagement.tsx src/App.tsx src/components/AdminSidebar.tsx
git commit -m "feat(admin): consultant + placement moderation pages"
```

---

# Phase 11 — Tests + Smoke

### Task 31: Playwright E2E for consultant flow

**Files:**
- Create: `tests/e2e/consultant-flow.spec.ts`
- Modify: `tests/e2e/visual-smoke.spec.ts`

- [ ] **Step 1: Write E2E test**

Create `tests/e2e/consultant-flow.spec.ts`:

```ts
import { test, expect, Page } from '@playwright/test';

const CONSULTANT = { email: 'consultant1@edufleet.test', password: 'password123' };
const TEACHER = { email: 'teacher1@edufleet.test', password: 'password123' };

async function login(page: Page, user: typeof CONSULTANT) {
  await page.goto('/login');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
}

test.setTimeout(60_000);

test('teacher grants consent', async ({ page }) => {
  await login(page, TEACHER);
  await page.waitForURL('**/teacher/dashboard');
  // Toggle consent
  const toggle = page.getByLabel(/Off — only you can apply|Consultants may apply/);
  await toggle.click();
  await expect(page.getByText(/Consultants can now apply on your behalf/i)).toBeVisible({ timeout: 5000 });
});

test('consultant signs in and sees dashboard', async ({ page }) => {
  await login(page, CONSULTANT);
  await page.waitForURL('**/consultant/dashboard', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Consultant Dashboard' })).toBeVisible();
});

test('consultant adds a teacher to roster', async ({ page }) => {
  await login(page, CONSULTANT);
  await page.waitForURL('**/consultant/dashboard');
  await page.goto('/consultant/roster');
  await page.getByRole('button', { name: /^Add teacher$/ }).click();
  await page.getByPlaceholder(/Search teachers/i).fill(TEACHER.email);
  await page.getByRole('button', { name: 'Search' }).click();
  // Pick first result if any, then add
  const firstRow = page.locator('li button').first();
  if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstRow.click();
    await page.getByRole('button', { name: /Add to roster/ }).click();
    await expect(page.getByText(/Added to roster|Already in your roster/i)).toBeVisible({ timeout: 5000 });
  }
});
```

- [ ] **Step 2: Add consultant-dashboard surface to visual smoke**

In `tests/e2e/visual-smoke.spec.ts`, add a new test inside the `for (const viewport of VIEWPORTS)` loop, after the existing dashboard tests:

```ts
test('consultant dashboard', async ({ page }) => {
  await loginAs(page, { email: 'consultant1@edufleet.test', password: 'password123', dashboard: '/consultant/dashboard' });
  await snap(page, viewport, '14-consultant-dashboard');
});
```

(Confirm the `loginAs` helper exists in the file — if its `dashboard` URL is hard-coded elsewhere, adapt to the existing pattern. The persona signature should already accept `dashboard` per the file as edited at the top of this session.)

- [ ] **Step 3: Run server + UI + tests**

```bash
# Terminal 1
cd server && pnpm dev

# Terminal 2
cd edufleetexchange_ui && pnpm dev

# Terminal 3 (once both are up)
cd edufleetexchange_ui && pnpm exec playwright test consultant-flow.spec.ts
```

Expected: all 3 consultant-flow tests pass. Visual smoke should produce `14-consultant-dashboard.png` for all three viewports.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/consultant-flow.spec.ts tests/e2e/visual-smoke.spec.ts
git commit -m "test(e2e): consultant signup/roster/consent + visual smoke"
```

---

### Task 32: Spec-coverage gap fillers (PricingSection, populated badge, mobile sweep)

**Files:**
- Modify: `src/components/PricingSection.tsx`
- Modify: `server/controllers/applicationController.ts` (institute-applications handler)
- Modify: `server/models/Notification.ts`
- Manual: mobile responsiveness pass on consultant pages

- [ ] **Step 1: Surface consultant plans in PricingSection**

In `src/components/PricingSection.tsx`, find the plan-type tabs/sections (grep `planType` or `'institute'`). Add a `'consultant'` tab/section that reads consultant plans via the existing plan-list endpoint (`/subscription-plans?planType=consultant`). Follow the existing tab pattern. Concrete edit:

```tsx
// In the planType filter array near the top:
const PLAN_TYPES = ['institute', 'teacher', 'vendor', 'consultant'] as const;

// In the tab labels mapping:
const LABELS = { institute: 'Institutes', teacher: 'Teachers', vendor: 'Vendors', consultant: 'Consultants' };
```

(Replace existing literals; do not introduce a parallel branch.)

- [ ] **Step 2: Populate consultant data on institute-application list**

In the institute-applications controller (likely `getApplicationsForInstitute` or similar — grep `applications` in `server/controllers/`), update the populate chain so the UI badge can render with name + agency:

```ts
const items = await Application.find({ instituteId: req.account!.id })
  .populate('teacherId', 'name email avatar')
  .populate('submittedByConsultantId', 'name email phone')
  // existing populates kept above
  .sort({ appliedDate: -1 });
```

If `agencyName` is needed in the badge, also fetch the consultant profile in a second step:

```ts
import ConsultantProfile from '../models/ConsultantProfile.js';

const consultantIds = items
  .map((a: any) => a.submittedByConsultantId?._id ?? a.submittedByConsultantId)
  .filter(Boolean);
const profiles = consultantIds.length
  ? await ConsultantProfile.find({ accountId: { $in: consultantIds } })
  : [];
const profileByAccountId = new Map(profiles.map((p) => [String(p.accountId), p]));

const enriched = items.map((a: any) => {
  const consultantId = String(a.submittedByConsultantId?._id ?? a.submittedByConsultantId ?? '');
  const cp = consultantId ? profileByAccountId.get(consultantId) : undefined;
  return {
    ...a.toJSON(),
    submittedByConsultantId: a.submittedByConsultantId
      ? { id: consultantId, name: a.submittedByConsultantId.name, email: a.submittedByConsultantId.email, phone: a.submittedByConsultantId.phone, agencyName: cp?.agencyName }
      : undefined,
  };
});
res.status(200).json({ success: true, data: enriched, timestamp: new Date().toISOString() });
```

- [ ] **Step 3: Add new Notification type enum values**

In `server/models/Notification.ts`, find the `type` enum and extend it to include:

```ts
type: {
  type: String,
  enum: [
    // ...existing values,
    'consultant_added_to_roster',
    'consultant_consent_revoked',
    'placement_stage_changed',
    'interview_invitation',
    'placement_completed',
  ],
  required: true,
},
```

(Don't remove existing values — only add. If `type` is currently free-form `String` with no enum, leave as-is.)

- [ ] **Step 4: Mobile-responsiveness pass on consultant pages**

Manually verify each new consultant page renders correctly at 360 × 800. For each of the following, check the layout and resolve any horizontal scroll, overlap, or off-screen actions:

- `/consultant/signup` — form grid should collapse to 1 column at sm.
- `/consultant/dashboard` — 4-stat row should collapse to 2×2; kanban should be horizontally scrollable.
- `/consultant/roster` — cards should be 1 column at sm.
- `/consultant/jobs` and `/consultant/teachers` — cards 1 column at sm; search bar should not overflow.
- `/consultant/placements` and `/consultant/interviews` — tab list should wrap (use `flex-wrap`).
- Dialogs (`AddToRosterDialog`, `InterviewScheduler`, `ProposeMatchesDialog`) — pick up the new default `w-[95vw] sm:max-w-lg` from `dialog.tsx`; no overrides needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/PricingSection.tsx server/controllers/applicationController.ts server/models/Notification.ts
git commit -m "feat(misc): consultant plans in pricing, populated badge data, notification types"
```

---

## Self-review notes (run before handing the plan off)

- **Spec section 3 (Data model)** — all 4 new models + 3 schema extensions covered (Tasks 1–7).
- **Spec section 4 (Auth)** — covered (Tasks 8–10).
- **Spec section 5 (API endpoints)** — every endpoint in the spec maps to a task. Roster (T11), consent (T12), placement (T14), applications-on-behalf (T15), interviews (T17), profile (T18), recommendations (T19), admin (T30).
- **Spec section 6 (UI surfaces)** — every page + component listed in the spec maps to a task. Signup (T23), Dashboard+PlacementCard (T24), Roster+AddToRosterDialog (T25), Placements+Interviews+InterviewScheduler (T26), JobSearch+TeacherSearch+ProposeMatchesDialog (T27), ConsultantBadge+Header (T28), TeacherConsentToggle (T29), Admin (T30), PricingSection (T32).
- **Spec section 7 (Cross-persona)** — Institute badge (T28), Teacher consent widget (T29), Admin views (T30).
- **Spec section 8 (Notification matrix)** — Notification fan-out in `interviewService` (T16) and enum extension (T32). Placement-stage and roster-add notifications are still TODO at the wiring level — currently only interview_invitation fires; the placement service and roster controller do not emit notifications. If exhaustive coverage is required, an extra task can be added to wire `transitionStage` + `createRoster` to insert `Notification` rows. Marked as a known v1 gap.
- **Type consistency** — `submittedByConsultantId`, `ConsultantSignupRequest`, `PlacementStage`, `InterviewMode` consistent across server and UI. `req.account.id` used everywhere (matches middleware contract).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-04-job-consultant-persona.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
