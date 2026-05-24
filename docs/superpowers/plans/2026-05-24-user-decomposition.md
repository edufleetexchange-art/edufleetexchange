# User Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the User god-schema with `Account` + per-persona profile collections (`InstituteProfile`, `TeacherProfile`, `VendorProfile`, `StaffProfile`) and pull `Subscription` into its own collection. Update both repos. Establish baseline test infrastructure.

**Architecture:** Pre-launch refactor with no migration burden — collections can be dropped and reshaped freely. The new auth middleware populates `req.account`, `req.profile`, `req.subscription` once per request via a single Mongoose aggregation. Foreign keys across other models change `ref: 'User'` → `ref: 'Account'`; API field names stay the same to limit client-side churn. Service layer enforces the invariant "Account.role matches existing profile". Spec: [`docs/superpowers/specs/2026-05-24-user-decomposition-design.md`](../specs/2026-05-24-user-decomposition-design.md).

**Tech Stack:** Server — Express 5, Mongoose 9, TypeScript ESM, JWT cookies, bcryptjs. Tests — Vitest, supertest, mongodb-memory-server. Frontend — React 19, Vite 7, React Router 7, Radix/shadcn, Axios.

**Repos:**
- Server repo: `/Users/automicai/Documents/GitHub/eduFleet/edufleetexchange` (git root)
  - Server code lives at `edufleetexchange/server/` inside the repo.
  - **All server file paths in this plan are relative to `edufleetexchange/server/`** (e.g., `models/Account.ts` → `edufleetexchange/server/models/Account.ts`).
  - **`npm` commands run from `edufleetexchange/server/`.**
  - **`git` commands run from `edufleetexchange/`** (the git root). When a step says `git add models/`, run it from the git root and prefix with `server/`: `git add server/models/`. The plan's commit examples show the cwd explicitly when ambiguous.
- UI repo: `/Users/automicai/Documents/GitHub/eduFleet/edufleetexchange_ui` (git root + code root are the same).
  - All UI paths in this plan are relative to this directory.

**Cwd convention shorthand used below:**
- "in server" / "(server)" → cd to `edufleetexchange/server`
- "in server git root" → cd to `edufleetexchange/`
- "in UI" → cd to `edufleetexchange_ui/`

---

## Phase 1 — Test infrastructure & CI

### Task 1: Install test stack and write the bundle-shape anchor test

**Files:**
- Modify: `package.json` (server)
- Create: `vitest.config.ts` (server)
- Create: `tests/setup.ts` (server)
- Create: `tests/anchor.test.ts` (server)

- [ ] **Step 1: Install test dependencies**

```bash
cd edufleetexchange/server
npm install --save-dev vitest@^2.1.0 supertest@^7.0.0 @types/supertest@^6.0.0 mongodb-memory-server@^10.1.0
```

Expected: success, no errors.

- [ ] **Step 2: Add test scripts to server `package.json`**

In `package.json`, add to the `scripts` block (alongside `dev`, `build`, etc.):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
```

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  if (collections) {
    for (const c of collections) await c.deleteMany({});
  }
});
```

- [ ] **Step 5: Create the failing anchor test `tests/anchor.test.ts`**

This intentionally fails until Phase 5 lands. It encodes the bundle-shape contract.

```ts
import { describe, it, expect } from 'vitest';

describe('auth bundle shape (anchor)', () => {
  it('login response contract is { account, profile, subscription }', async () => {
    // This will be implemented in Task 6. For now, document the contract.
    const expectedKeys = ['account', 'profile', 'subscription'].sort();
    const actual: string[] = []; // populated by Task 6
    expect(actual.sort()).toEqual(expectedKeys);
  });
});
```

- [ ] **Step 6: Run test, confirm it fails**

```bash
cd edufleetexchange/server && npm test
```

Expected: 1 test failed with `expected [] to deeply equal [ 'account', 'profile', 'subscription' ]`.

- [ ] **Step 7: Commit**

```bash
cd edufleetexchange/server
git add package.json package-lock.json vitest.config.ts tests/
git commit -m "$(cat <<'EOF'
test: install vitest + mongodb-memory-server, add bundle-shape anchor

Anchor test will guide Phase 5 implementation of the new auth bundle.
EOF
)"
```

---

### Task 2: GitHub Actions CI

**Files:**
- Create: `edufleetexchange/.github/workflows/test.yml` (at the server git root, *outside* the `server/` subdirectory).

UI CI is added in Task 20.

- [ ] **Step 1: Create the workflow file**

From the server git root (`edufleetexchange/`), create `.github/workflows/test.yml`:

```yaml
name: test
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  server-tests:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: server/package-lock.json
      - run: npm ci
      - run: npm test
```

The `working-directory: server` block matters because `package.json` lives at `edufleetexchange/server/package.json`, not at `edufleetexchange/package.json`.

- [ ] **Step 2: Commit (from server git root)**

```bash
cd edufleetexchange
git add .github/workflows/test.yml
git commit -m "ci: run vitest on PRs and main"
```

---

## Phase 2 — Account model

### Task 3: Create the `Account` model

**Files:**
- Create: `models/Account.ts`
- Create: `tests/models/account.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/models/account.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Account from '../../models/Account.js';

describe('Account model', () => {
  it('hashes the password on save', async () => {
    const a = await Account.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'plain-password',
      role: 'institute',
    });
    const fresh = await Account.findById(a._id).select('+password');
    expect(fresh!.password).not.toBe('plain-password');
    expect(fresh!.password).toMatch(/^\$2[aby]\$/); // bcrypt prefix
  });

  it('rejects duplicate emails', async () => {
    await Account.create({ name: 'A', email: 'dup@example.com', password: 'x', role: 'teacher' });
    await expect(
      Account.create({ name: 'B', email: 'dup@example.com', password: 'y', role: 'vendor' })
    ).rejects.toThrow();
  });

  it('lowercases email on save', async () => {
    const a = await Account.create({ name: 'X', email: 'MiXeD@Example.com', password: 'p', role: 'institute' });
    expect(a.email).toBe('mixed@example.com');
  });

  it('comparePassword works', async () => {
    const a = await Account.create({ name: 'X', email: 'cmp@example.com', password: 'mypass', role: 'institute' });
    const fresh: any = await Account.findById(a._id).select('+password');
    expect(await fresh.comparePassword('mypass')).toBe(true);
    expect(await fresh.comparePassword('wrong')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd edufleetexchange/server && npm test -- tests/models/account.test.ts
```

Expected: `Cannot find module '../../models/Account.js'`.

- [ ] **Step 3: Implement `models/Account.ts`**

```ts
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type AccountRole = 'institute' | 'teacher' | 'vendor' | 'admin' | 'marketing' | 'sales';

export interface IAccount extends Document {
  name: string;
  email: string;
  password: string;
  role: AccountRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const accountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['institute', 'teacher', 'vendor', 'admin', 'marketing', 'sales'],
      required: true,
    },
    phone: { type: String, trim: true },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

accountSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

accountSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IAccount>('Account', accountSchema);
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd edufleetexchange/server && npm test -- tests/models/account.test.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add models/Account.ts tests/models/account.test.ts
git commit -m "feat(model): add Account identity model with bcrypt + uniqueness tests"
```

---

## Phase 3 — Profile models

### Task 4: Create four persona profile models in one task

**Files:**
- Create: `models/InstituteProfile.ts`
- Create: `models/TeacherProfile.ts`
- Create: `models/VendorProfile.ts`
- Create: `models/StaffProfile.ts`
- Create: `tests/models/profiles.test.ts`

All four profiles share the pattern: `accountId` is unique 1:1 with `Account`, plus persona-specific fields. Tests verify the unique constraint and required fields per profile.

- [ ] **Step 1: Write the failing test `tests/models/profiles.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Account from '../../models/Account.js';
import InstituteProfile from '../../models/InstituteProfile.js';
import TeacherProfile from '../../models/TeacherProfile.js';
import VendorProfile from '../../models/VendorProfile.js';
import StaffProfile from '../../models/StaffProfile.js';

async function makeAccount(role: string = 'institute') {
  return Account.create({ name: 'X', email: `x-${Date.now()}-${Math.random()}@e.com`, password: 'pwpwpw', role });
}

describe('Profile models', () => {
  describe('InstituteProfile', () => {
    it('creates and links to Account by accountId', async () => {
      const a = await makeAccount('institute');
      const p = await InstituteProfile.create({
        accountId: a._id,
        instituteName: 'Demo School',
        contactPerson: 'A. Sharma',
        instituteSearchability: true,
        address: { street: '1 St', city: 'BLR', state: 'KA', pincode: '560001', country: 'India' },
      });
      expect(String(p.accountId)).toBe(String(a._id));
    });

    it('enforces unique accountId', async () => {
      const a = await makeAccount('institute');
      await InstituteProfile.create({ accountId: a._id, instituteName: 'A', address: { city: 'X', state: 'Y', pincode: '1', country: 'India', street: '1' } });
      await expect(
        InstituteProfile.create({ accountId: a._id, instituteName: 'B', address: { city: 'X', state: 'Y', pincode: '1', country: 'India', street: '1' } })
      ).rejects.toThrow();
    });
  });

  describe('TeacherProfile', () => {
    it('creates with qualifications and subjects', async () => {
      const a = await makeAccount('teacher');
      const p = await TeacherProfile.create({
        accountId: a._id,
        experience: 5,
        qualifications: ['M.Sc.', 'B.Ed.'],
        subjects: ['Math', 'Physics'],
        isAvailable: true,
      });
      expect(p.qualifications).toContain('M.Sc.');
      expect(p.subjects).toContain('Math');
    });
  });

  describe('VendorProfile', () => {
    it('creates with business fields', async () => {
      const a = await makeAccount('vendor');
      const p = await VendorProfile.create({
        accountId: a._id,
        businessName: 'Acme Books',
        contactPerson: 'V. Mehta',
        phone: '+91...',
      });
      expect(p.businessName).toBe('Acme Books');
    });
  });

  describe('StaffProfile', () => {
    it('creates with employeeId', async () => {
      const a = await makeAccount('admin');
      const p = await StaffProfile.create({ accountId: a._id, employeeId: 'EMP-001', department: 'Platform' });
      expect(p.employeeId).toBe('EMP-001');
    });

    it('enforces unique employeeId (sparse)', async () => {
      const a1 = await makeAccount('admin');
      const a2 = await makeAccount('marketing');
      await StaffProfile.create({ accountId: a1._id, employeeId: 'EMP-DUP' });
      await expect(
        StaffProfile.create({ accountId: a2._id, employeeId: 'EMP-DUP' })
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npm test -- tests/models/profiles.test.ts
```

Expected: module-not-found errors for all four profile files.

- [ ] **Step 3: Implement `models/InstituteProfile.ts`**

```ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IInstituteProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  instituteName: string;
  contactPerson?: string;
  instituteSearchability: boolean;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IInstituteProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    instituteName: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    instituteSearchability: { type: Boolean, default: false },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

export default mongoose.model<IInstituteProfile>('InstituteProfile', schema);
```

- [ ] **Step 4: Implement `models/TeacherProfile.ts`**

```ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ITeacherProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  experience: number;
  qualifications: string[];
  subjects: string[];
  bio?: string;
  location?: string;
  preferredLocation?: string[];
  currentInstitute?: string;
  achievements?: string[];
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITeacherProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    experience: { type: Number, default: 0, min: 0 },
    qualifications: { type: [String], default: [] },
    subjects: { type: [String], default: [] },
    bio: { type: String, trim: true },
    location: { type: String, trim: true },
    preferredLocation: { type: [String], default: [] },
    currentInstitute: { type: String, trim: true },
    achievements: { type: [String], default: [] },
    isAvailable: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ subjects: 1 });
schema.index({ location: 1 });
schema.index({ experience: 1 });

export default mongoose.model<ITeacherProfile>('TeacherProfile', schema);
```

- [ ] **Step 5: Implement `models/VendorProfile.ts`**

```ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  businessName: string;
  contactPerson?: string;
  phone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IVendorProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

export default mongoose.model<IVendorProfile>('VendorProfile', schema);
```

- [ ] **Step 6: Implement `models/StaffProfile.ts`**

```ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  employeeId?: string;
  department?: string;
  permissions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IStaffProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      set: function (v: string | undefined | null): string | undefined {
        if (v === null || v === undefined || v === '') return undefined;
        return v.trim();
      },
    },
    department: { type: String, trim: true },
    permissions: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

export default mongoose.model<IStaffProfile>('StaffProfile', schema);
```

- [ ] **Step 7: Run tests, confirm all pass**

```bash
npm test -- tests/models/profiles.test.ts
```

Expected: 6 tests passing.

- [ ] **Step 8: Commit**

```bash
git add models/InstituteProfile.ts models/TeacherProfile.ts models/VendorProfile.ts models/StaffProfile.ts tests/models/profiles.test.ts
git commit -m "feat(model): add four persona profile models with 1:1 accountId"
```

---

## Phase 4 — Subscription model

### Task 5: Create the `Subscription` model with active-uniqueness

**Files:**
- Create: `models/Subscription.ts`
- Create: `tests/models/subscription.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/models/subscription.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Account from '../../models/Account.js';
import Subscription from '../../models/Subscription.js';

async function makeAccount() {
  return Account.create({ name: 'X', email: `s-${Date.now()}-${Math.random()}@e.com`, password: 'pwpwpw', role: 'institute' });
}

describe('Subscription model', () => {
  it('creates a subscription linked to an account', async () => {
    const a = await makeAccount();
    const s = await Subscription.create({
      accountId: a._id,
      status: 'active',
      paymentStatus: 'completed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 86400e3),
      listingsUsed: 0, listingsLimit: 5,
      jobPostsUsed: 0, jobPostsLimit: 3,
      browseCount: 0, browseCountLimit: 100,
    });
    expect(s.status).toBe('active');
  });

  it('allows multiple non-active subscriptions for the same account', async () => {
    const a = await makeAccount();
    await Subscription.create({ accountId: a._id, status: 'expired', paymentStatus: 'completed', startDate: new Date(), endDate: new Date(), listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0 });
    await Subscription.create({ accountId: a._id, status: 'expired', paymentStatus: 'completed', startDate: new Date(), endDate: new Date(), listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0 });
    const count = await Subscription.countDocuments({ accountId: a._id });
    expect(count).toBe(2);
  });

  it('enforces only one active subscription per account', async () => {
    const a = await makeAccount();
    await Subscription.create({ accountId: a._id, status: 'active', paymentStatus: 'completed', startDate: new Date(), endDate: new Date(), listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0 });
    await expect(
      Subscription.create({ accountId: a._id, status: 'active', paymentStatus: 'completed', startDate: new Date(), endDate: new Date(), listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0 })
    ).rejects.toThrow();
  });

  it('atomic increment on listingsUsed', async () => {
    const a = await makeAccount();
    await Subscription.create({ accountId: a._id, status: 'active', paymentStatus: 'completed', startDate: new Date(), endDate: new Date(), listingsUsed: 0, listingsLimit: 100, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0 });
    await Promise.all(Array.from({ length: 10 }).map(() =>
      Subscription.updateOne({ accountId: a._id, status: 'active' }, { $inc: { listingsUsed: 1 } })
    ));
    const s = await Subscription.findOne({ accountId: a._id, status: 'active' });
    expect(s!.listingsUsed).toBe(10);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npm test -- tests/models/subscription.test.ts
```

Expected: `Cannot find module '../../models/Subscription.js'`.

- [ ] **Step 3: Implement `models/Subscription.ts`**

```ts
import mongoose, { Schema, Document } from 'mongoose';

export type SubStatus = 'active' | 'inactive' | 'suspended' | 'expired';
export type PayStatus = 'pending' | 'completed' | 'failed';

export interface ISubscription extends Document {
  accountId: mongoose.Types.ObjectId;
  planId?: mongoose.Types.ObjectId;
  status: SubStatus;
  paymentStatus: PayStatus;
  transactionId?: string;
  startDate: Date;
  endDate: Date;
  listingsUsed: number;
  listingsLimit: number;
  jobPostsUsed: number;
  jobPostsLimit: number;
  browseCount: number;
  browseCountLimit: number;
  lastBrowseReset?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISubscription>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'expired'], default: 'inactive' },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    transactionId: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    listingsUsed: { type: Number, default: 0 },
    listingsLimit: { type: Number, default: 0 },
    jobPostsUsed: { type: Number, default: 0 },
    jobPostsLimit: { type: Number, default: 0 },
    browseCount: { type: Number, default: 0 },
    browseCountLimit: { type: Number, default: 0 },
    lastBrowseReset: Date,
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

// Only one active subscription per account
schema.index(
  { accountId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export default mongoose.model<ISubscription>('Subscription', schema);
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npm test -- tests/models/subscription.test.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add models/Subscription.ts tests/models/subscription.test.ts
git commit -m "feat(model): add Subscription collection with active-uniqueness invariant"
```

---

## Phase 5 — Auth service

### Task 6: `authService.signupInstitute / signupTeacher / signupVendor` (transactional)

**Files:**
- Create: `services/authService.ts`
- Create: `tests/services/authService.test.ts`

Note: Mongoose transactions require a replica set. `mongodb-memory-server` can spin one up with `MongoMemoryReplSet`. Update `tests/setup.ts` to use the replica set when needed.

- [ ] **Step 1: Update `tests/setup.ts` to use a replica set**

Replace the contents of `tests/setup.ts` with:

```ts
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';

let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  if (collections) {
    for (const c of collections) await c.deleteMany({});
  }
});
```

- [ ] **Step 2: Write the failing test `tests/services/authService.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import Account from '../../models/Account.js';
import InstituteProfile from '../../models/InstituteProfile.js';
import TeacherProfile from '../../models/TeacherProfile.js';
import VendorProfile from '../../models/VendorProfile.js';
import Subscription from '../../models/Subscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import * as authService from '../../services/authService.js';

async function seedPlan(planType: 'institute' | 'teacher' | 'vendor') {
  return SubscriptionPlan.create({
    name: `${planType}-free`,
    displayName: `${planType} free`,
    planType,
    description: 'free',
    price: 0,
    duration: 30,
    features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    isActive: true,
  });
}

describe('authService.signupInstitute', () => {
  it('creates Account + InstituteProfile + Subscription in one transaction', async () => {
    await seedPlan('institute');
    const bundle = await authService.signupInstitute({
      name: 'Demo School', email: 'inst@e.com', password: 'pwpwpw', phone: '+91...',
      instituteName: 'Demo Public School', contactPerson: 'A',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '560001', country: 'India' },
    });
    expect(bundle.account.email).toBe('inst@e.com');
    expect((bundle.profile as any).instituteName).toBe('Demo Public School');
    expect(bundle.subscription.status).toBe('active');
    expect(await Account.countDocuments({})).toBe(1);
    expect(await InstituteProfile.countDocuments({})).toBe(1);
    expect(await Subscription.countDocuments({})).toBe(1);
  });

  it('rolls back all 3 documents on duplicate email', async () => {
    await seedPlan('institute');
    await authService.signupInstitute({
      name: 'A', email: 'dup@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    await expect(
      authService.signupInstitute({
        name: 'B', email: 'dup@e.com', password: 'pwpwpw',
        instituteName: 'Y', address: { street: '2', city: 'BLR', state: 'KA', pincode: '2', country: 'India' },
      })
    ).rejects.toThrow();
    // Still only 1 Account, 1 Profile, 1 Subscription (first call's docs)
    expect(await Account.countDocuments({})).toBe(1);
    expect(await InstituteProfile.countDocuments({})).toBe(1);
    expect(await Subscription.countDocuments({})).toBe(1);
  });
});

describe('authService.signupTeacher', () => {
  it('creates Account + TeacherProfile + Subscription', async () => {
    await seedPlan('teacher');
    const bundle = await authService.signupTeacher({
      name: 'T', email: 't@e.com', password: 'pwpwpw',
      experience: 5, qualifications: ['M.Sc.'], subjects: ['Math'], isAvailable: true,
    });
    expect(bundle.account.role).toBe('teacher');
    expect((bundle.profile as any).subjects).toContain('Math');
  });
});

describe('authService.signupVendor', () => {
  it('creates Account + VendorProfile + Subscription', async () => {
    await seedPlan('vendor');
    const bundle = await authService.signupVendor({
      name: 'V', email: 'v@e.com', password: 'pwpwpw',
      businessName: 'Acme', contactPerson: 'M',
    });
    expect(bundle.account.role).toBe('vendor');
    expect((bundle.profile as any).businessName).toBe('Acme');
  });
});

describe('authService.login', () => {
  it('returns the full bundle on valid credentials', async () => {
    await seedPlan('teacher');
    await authService.signupTeacher({ name: 'T', email: 'login@e.com', password: 'pwpwpw', experience: 1, qualifications: [], subjects: ['Math'] });
    const bundle = await authService.login('login@e.com', 'pwpwpw');
    expect(bundle.account.email).toBe('login@e.com');
    expect(bundle.profile).toBeTruthy();
    expect(bundle.subscription).toBeTruthy();
  });

  it('rejects bad password', async () => {
    await seedPlan('teacher');
    await authService.signupTeacher({ name: 'T', email: 'bad@e.com', password: 'pwpwpw', experience: 1, qualifications: [], subjects: ['Math'] });
    await expect(authService.login('bad@e.com', 'wrong')).rejects.toThrow();
  });

  it('rejects inactive account', async () => {
    await seedPlan('teacher');
    const bundle = await authService.signupTeacher({ name: 'T', email: 'off@e.com', password: 'pwpwpw', experience: 1, qualifications: [], subjects: ['Math'] });
    await Account.updateOne({ _id: bundle.account.id }, { isActive: false });
    await expect(authService.login('off@e.com', 'pwpwpw')).rejects.toThrow(/inactive/i);
  });
});

describe('authService.loadBundle', () => {
  it('loads bundle by accountId with profile matched to role', async () => {
    await seedPlan('teacher');
    const created = await authService.signupTeacher({ name: 'T', email: 'b@e.com', password: 'pwpwpw', experience: 3, qualifications: [], subjects: ['Math'] });
    const bundle = await authService.loadBundle(String(created.account.id));
    expect(bundle.account.email).toBe('b@e.com');
    expect((bundle.profile as any).subjects).toContain('Math');
    expect(bundle.subscription.status).toBe('active');
  });
});
```

- [ ] **Step 3: Run test, confirm it fails**

```bash
npm test -- tests/services/authService.test.ts
```

Expected: `Cannot find module '../../services/authService.js'`.

- [ ] **Step 4: Implement `services/authService.ts`**

```ts
import mongoose from 'mongoose';
import Account from '../models/Account.js';
import InstituteProfile from '../models/InstituteProfile.js';
import TeacherProfile from '../models/TeacherProfile.js';
import VendorProfile from '../models/VendorProfile.js';
import StaffProfile from '../models/StaffProfile.js';
import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

type Address = { street: string; city: string; state: string; pincode: string; country?: string };

export type Bundle = {
  account: any;
  profile: any;
  subscription: any;
};

async function findFreePlan(planType: 'institute' | 'teacher' | 'vendor') {
  return SubscriptionPlan.findOne({ planType, price: 0, isActive: true });
}

function defaultSubscriptionFromPlan(accountId: mongoose.Types.ObjectId, plan: any) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (plan?.duration ?? 30));
  return {
    accountId,
    planId: plan?._id,
    status: 'active' as const,
    paymentStatus: 'completed' as const,
    startDate,
    endDate,
    listingsUsed: 0,
    listingsLimit: plan?.features?.maxListings ?? plan?.features?.maxVehicleListings ?? plan?.features?.maxProductListings ?? 0,
    jobPostsUsed: 0,
    jobPostsLimit: plan?.features?.maxJobPosts ?? 0,
    browseCount: 0,
    browseCountLimit: plan?.features?.maxBrowsesPerMonth ?? 0,
    lastBrowseReset: startDate,
    notes: 'Free plan assigned on signup',
  };
}

function avatarFor(email: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;
}

export interface InstituteSignupInput {
  name: string; email: string; password: string; phone?: string;
  instituteName: string; contactPerson?: string;
  address: Address;
  instituteSearchability?: boolean;
}

export async function signupInstitute(input: InstituteSignupInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create([{
        name: input.name, email: input.email, password: input.password,
        role: 'institute', phone: input.phone, avatar: avatarFor(input.email),
        isVerified: false, isActive: true,
      }], { session });
      const [profile] = await InstituteProfile.create([{
        accountId: account._id,
        instituteName: input.instituteName,
        contactPerson: input.contactPerson,
        instituteSearchability: input.instituteSearchability ?? false,
        address: input.address,
      }], { session });
      const plan = await SubscriptionPlan.findOne({ planType: 'institute', price: 0, isActive: true }).session(session);
      const [subscription] = await Subscription.create([defaultSubscriptionFromPlan(account._id, plan)], { session });
      return { account: account.toJSON(), profile: profile.toJSON(), subscription: subscription.toJSON() };
    });
  } finally {
    session.endSession();
  }
}

export interface TeacherSignupInput {
  name: string; email: string; password: string; phone?: string;
  experience: number; qualifications: string[]; subjects: string[];
  bio?: string; location?: string; preferredLocation?: string[];
  isAvailable?: boolean;
}

export async function signupTeacher(input: TeacherSignupInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create([{
        name: input.name, email: input.email, password: input.password,
        role: 'teacher', phone: input.phone, avatar: avatarFor(input.email),
        isActive: true, isVerified: false,
      }], { session });
      const [profile] = await TeacherProfile.create([{
        accountId: account._id,
        experience: input.experience,
        qualifications: input.qualifications,
        subjects: input.subjects,
        bio: input.bio, location: input.location,
        preferredLocation: input.preferredLocation,
        isAvailable: input.isAvailable ?? true,
      }], { session });
      const plan = await SubscriptionPlan.findOne({ planType: 'teacher', price: 0, isActive: true }).session(session);
      const [subscription] = await Subscription.create([defaultSubscriptionFromPlan(account._id, plan)], { session });
      return { account: account.toJSON(), profile: profile.toJSON(), subscription: subscription.toJSON() };
    });
  } finally {
    session.endSession();
  }
}

export interface VendorSignupInput {
  name: string; email: string; password: string; phone?: string;
  businessName: string; contactPerson?: string; website?: string;
  address?: Partial<Address>;
}

export async function signupVendor(input: VendorSignupInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create([{
        name: input.name, email: input.email, password: input.password,
        role: 'vendor', phone: input.phone, avatar: avatarFor(input.email),
        isActive: true, isVerified: false,
      }], { session });
      const [profile] = await VendorProfile.create([{
        accountId: account._id,
        businessName: input.businessName,
        contactPerson: input.contactPerson,
        phone: input.phone,
        website: input.website,
        address: input.address,
      }], { session });
      const plan = await SubscriptionPlan.findOne({ planType: 'vendor', price: 0, isActive: true }).session(session);
      const [subscription] = await Subscription.create([defaultSubscriptionFromPlan(account._id, plan)], { session });
      return { account: account.toJSON(), profile: profile.toJSON(), subscription: subscription.toJSON() };
    });
  } finally {
    session.endSession();
  }
}

const PROFILE_MODEL_BY_ROLE: Record<string, any> = {
  institute: InstituteProfile,
  teacher: TeacherProfile,
  vendor: VendorProfile,
  admin: StaffProfile,
  marketing: StaffProfile,
  sales: StaffProfile,
};

export async function loadBundle(accountId: string): Promise<Bundle> {
  const account = await Account.findById(accountId);
  if (!account) throw new Error('Account not found');
  const ProfileModel = PROFILE_MODEL_BY_ROLE[account.role];
  const [profile, subscription] = await Promise.all([
    ProfileModel ? ProfileModel.findOne({ accountId: account._id }) : Promise.resolve(null),
    Subscription.findOne({ accountId: account._id, status: 'active' }),
  ]);
  return {
    account: account.toJSON(),
    profile: profile ? profile.toJSON() : null,
    subscription: subscription ? subscription.toJSON() : null,
  };
}

export async function login(email: string, password: string): Promise<Bundle> {
  const account = await Account.findOne({ email: email.toLowerCase() }).select('+password');
  if (!account) throw new Error('Invalid credentials');
  const ok = await (account as any).comparePassword(password);
  if (!ok) throw new Error('Invalid credentials');
  if (!account.isActive) throw new Error('Account is inactive');
  return loadBundle(String(account._id));
}
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
npm test -- tests/services/authService.test.ts
```

Expected: all tests passing.

- [ ] **Step 6: Update the anchor test in `tests/anchor.test.ts`**

Replace its body to actually exercise the new service:

```ts
import { describe, it, expect } from 'vitest';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import * as authService from '../services/authService.js';

describe('auth bundle shape (anchor)', () => {
  it('login response contract is { account, profile, subscription }', async () => {
    await SubscriptionPlan.create({
      name: 'inst-free', displayName: 'Institute Free', planType: 'institute',
      description: 'free', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    });
    await authService.signupInstitute({
      name: 'X', email: 'anchor@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const bundle = await authService.login('anchor@e.com', 'pwpwpw');
    expect(Object.keys(bundle).sort()).toEqual(['account', 'profile', 'subscription']);
  });
});
```

- [ ] **Step 7: Run all tests, confirm green**

```bash
npm test
```

Expected: anchor + Account + profiles + Subscription + authService = all pass.

- [ ] **Step 8: Commit**

```bash
git add tests/setup.ts services/authService.ts tests/services/authService.test.ts tests/anchor.test.ts
git commit -m "feat(service): add authService with transactional persona signups + login"
```

---

## Phase 6 — Subscription service

### Task 7: `subscriptionService` for atomic quota updates

**Files:**
- Create: `services/subscriptionService.ts`
- Create: `tests/services/subscriptionService.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/services/subscriptionService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Account from '../../models/Account.js';
import Subscription from '../../models/Subscription.js';
import { incrementUsage, canConsume } from '../../services/subscriptionService.js';

async function setup(limits: { listings: number; jobs: number; browse: number }) {
  const a = await Account.create({ name: 'X', email: `sub-${Math.random()}@e.com`, password: 'pwpwpw', role: 'institute' });
  await Subscription.create({
    accountId: a._id, status: 'active', paymentStatus: 'completed',
    startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400e3),
    listingsUsed: 0, listingsLimit: limits.listings,
    jobPostsUsed: 0, jobPostsLimit: limits.jobs,
    browseCount: 0, browseCountLimit: limits.browse,
  });
  return a;
}

describe('subscriptionService.incrementUsage', () => {
  it('increments listingsUsed atomically under concurrency', async () => {
    const a = await setup({ listings: 100, jobs: 0, browse: 0 });
    await Promise.all(Array.from({ length: 20 }).map(() => incrementUsage(String(a._id), 'listings')));
    const s = await Subscription.findOne({ accountId: a._id, status: 'active' });
    expect(s!.listingsUsed).toBe(20);
  });
});

describe('subscriptionService.canConsume', () => {
  it('returns true when under the limit', async () => {
    const a = await setup({ listings: 5, jobs: 0, browse: 0 });
    expect(await canConsume(String(a._id), 'listings')).toBe(true);
  });

  it('returns false when at the limit', async () => {
    const a = await setup({ listings: 1, jobs: 0, browse: 0 });
    await incrementUsage(String(a._id), 'listings');
    expect(await canConsume(String(a._id), 'listings')).toBe(false);
  });

  it('returns true when limit is 0 (unlimited)', async () => {
    const a = await setup({ listings: 0, jobs: 0, browse: 0 });
    expect(await canConsume(String(a._id), 'listings')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npm test -- tests/services/subscriptionService.test.ts
```

Expected: module-not-found.

- [ ] **Step 3: Implement `services/subscriptionService.ts`**

```ts
import Subscription from '../models/Subscription.js';

export type QuotaKey = 'listings' | 'jobPosts' | 'browse';

const USED_FIELD: Record<QuotaKey, string> = {
  listings: 'listingsUsed',
  jobPosts: 'jobPostsUsed',
  browse: 'browseCount',
};

const LIMIT_FIELD: Record<QuotaKey, string> = {
  listings: 'listingsLimit',
  jobPosts: 'jobPostsLimit',
  browse: 'browseCountLimit',
};

export async function incrementUsage(accountId: string, key: QuotaKey, by = 1): Promise<void> {
  await Subscription.updateOne(
    { accountId, status: 'active' },
    { $inc: { [USED_FIELD[key]]: by } }
  );
}

export async function canConsume(accountId: string, key: QuotaKey): Promise<boolean> {
  const s = await Subscription.findOne({ accountId, status: 'active' });
  if (!s) return false;
  const used = (s as any)[USED_FIELD[key]] ?? 0;
  const limit = (s as any)[LIMIT_FIELD[key]] ?? 0;
  if (limit === 0) return true; // 0 means unlimited per existing semantics
  return used < limit;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npm test -- tests/services/subscriptionService.test.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add services/subscriptionService.ts tests/services/subscriptionService.test.ts
git commit -m "feat(service): add subscriptionService with atomic quota inc + canConsume"
```

---

## Phase 7 — Middleware rewrite

### Task 8: Rewrite `middleware/auth.ts` to populate `req.account/profile/subscription`

**Files:**
- Modify: `middleware/auth.ts`
- Create: `tests/middleware/auth.test.ts`

The existing middleware exports `AuthRequest` with `req.user`. We rewrite the middleware to set `req.account`, `req.profile`, `req.subscription` instead, and keep `AuthRequest` exported but with a new shape.

- [ ] **Step 1: Read current middleware to understand the shape**

```bash
cat edufleetexchange/server/middleware/auth.ts
```

Note its current export interface so consumers can be migrated.

- [ ] **Step 2: Write the failing test `tests/middleware/auth.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JWT_CONFIG } from '../../config/jwt.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import Account from '../../models/Account.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import * as authService from '../../services/authService.js';

async function makeApp() {
  await SubscriptionPlan.create({
    name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    isActive: true,
  });
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.get('/me', authenticate, (req: any, res) => {
    res.json({ account: req.account, profile: req.profile, subscription: req.subscription });
  });
  app.get('/admin-only', authenticate, requireRole('admin'), (_req, res) => res.json({ ok: true }));
  return app;
}

function signFor(accountId: string) {
  return jwt.sign({ accountId, role: 'institute' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
}

describe('authenticate middleware', () => {
  it('rejects requests without a token', async () => {
    const app = await makeApp();
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  it('populates req.account/profile/subscription on a valid token', async () => {
    const app = await makeApp();
    const bundle = await authService.signupInstitute({
      name: 'X', email: 'mw@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = signFor(bundle.account.id);
    const res = await request(app).get('/me').set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.account.email).toBe('mw@e.com');
    expect(res.body.profile.instituteName).toBe('X');
    expect(res.body.subscription.status).toBe('active');
  });

  it('rejects inactive accounts', async () => {
    const app = await makeApp();
    const bundle = await authService.signupInstitute({
      name: 'X', email: 'off-mw@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    await Account.updateOne({ _id: bundle.account.id }, { isActive: false });
    const token = signFor(bundle.account.id);
    const res = await request(app).get('/me').set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(401);
  });
});

describe('requireRole', () => {
  it('blocks wrong role', async () => {
    const app = await makeApp();
    const bundle = await authService.signupInstitute({
      name: 'X', email: 'role@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = signFor(bundle.account.id);
    const res = await request(app).get('/admin-only').set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Rewrite `middleware/auth.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.js';
import { loadBundle } from '../services/authService.js';
import type { AccountRole } from '../models/Account.js';

export interface AuthRequest extends Request {
  account?: any;
  profile?: any;
  subscription?: any;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token =
      req.header('Authorization')?.replace('Bearer ', '') || (req as any).cookies?.token;
    if (!token) {
      res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }
    const payload = jwt.verify(token, JWT_CONFIG.secret) as { accountId: string; role: string };
    const bundle = await loadBundle(payload.accountId);
    if (!bundle.account) {
      res.status(401).json({ success: false, error: 'Account not found', code: 'NOT_FOUND' });
      return;
    }
    if (!bundle.account.isActive) {
      res.status(401).json({ success: false, error: 'Account inactive', code: 'ACCOUNT_INACTIVE' });
      return;
    }
    req.account = bundle.account;
    req.profile = bundle.profile;
    req.subscription = bundle.subscription;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}

export function requireRole(role: AccountRole | AccountRole[]) {
  const allowed = Array.isArray(role) ? role : [role];
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.account) {
      res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }
    if (!allowed.includes(req.account.role)) {
      res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npm test -- tests/middleware/auth.test.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add middleware/auth.ts tests/middleware/auth.test.ts
git commit -m "feat(middleware): authenticate populates req.account/profile/subscription"
```

---

## Phase 8 — Auth controller + routes

### Task 9: Rewrite `controllers/authController.ts` + `routes/auth.ts`

**Files:**
- Modify: `controllers/authController.ts` (full rewrite)
- Modify: `routes/auth.ts` (replace endpoints)
- Create: `tests/integration/auth.test.ts`

- [ ] **Step 1: Write the failing integration test**

`tests/integration/auth.test.ts`:

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
  await SubscriptionPlan.create([
    { name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'vend-free', displayName: 'V', planType: 'vendor', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/auth/institute/signup', () => {
  it('creates Account + InstituteProfile + Subscription and returns bundle', async () => {
    const res = await request(app).post('/api/auth/institute/signup').send({
      name: 'D', email: 'd@e.com', password: 'pwpwpw',
      instituteName: 'Demo', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.account.email).toBe('d@e.com');
    expect(res.body.data.profile.instituteName).toBe('Demo');
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=/);
  });

  it('returns 409 on duplicate email', async () => {
    const body = { name: 'D', email: 'dup@e.com', password: 'pwpwpw', instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' } };
    await request(app).post('/api/auth/institute/signup').send(body);
    const res = await request(app).post('/api/auth/institute/signup').send(body);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/teacher/signup', () => {
  it('creates teacher bundle', async () => {
    const res = await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: 't@e.com', password: 'pwpwpw',
      experience: 5, qualifications: ['M.Sc.'], subjects: ['Math'],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.account.role).toBe('teacher');
  });
});

describe('POST /api/auth/vendor/signup', () => {
  it('creates vendor bundle', async () => {
    const res = await request(app).post('/api/auth/vendor/signup').send({
      name: 'V', email: 'v@e.com', password: 'pwpwpw',
      businessName: 'Acme',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.account.role).toBe('vendor');
  });
});

describe('POST /api/auth/login + GET /api/auth/me', () => {
  it('login returns bundle; /me returns same shape', async () => {
    await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: 'me@e.com', password: 'pwpwpw', experience: 1, qualifications: [], subjects: ['Math'],
    });
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'me@e.com', password: 'pwpwpw' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.account.email).toBe('me@e.com');
    const cookie = loginRes.headers['set-cookie'][0];
    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(meRes.status).toBe(200);
    expect(Object.keys(meRes.body.data).sort()).toEqual(['account', 'profile', 'subscription']);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npm test -- tests/integration/auth.test.ts
```

Expected: all four describe-blocks fail (routes don't exist yet).

- [ ] **Step 3: Replace `controllers/authController.ts`**

```ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.js';
import * as authService from '../services/authService.js';
import { AuthRequest } from '../middleware/auth.js';

function setAuthCookie(res: Response, accountId: string, role: string) {
  const token = jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
  res.cookie('token', token, JWT_CONFIG.cookieOptions);
  return token;
}

function handleErr(res: Response, err: any, fallback = 500) {
  const msg = err instanceof Error ? err.message : 'Request failed';
  const status =
    /already exists|duplicate/i.test(msg) ? 409 :
    /Invalid credentials|inactive/i.test(msg) ? 401 :
    fallback;
  res.status(status).json({ success: false, error: msg, code: 'AUTH_ERROR' });
}

export const signupInstitute = async (req: Request, res: Response): Promise<void> => {
  try {
    const bundle = await authService.signupInstitute(req.body);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(201).json({ success: true, data: bundle, message: 'Institute registered', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};

export const signupTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const bundle = await authService.signupTeacher(req.body);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(201).json({ success: true, data: bundle, message: 'Teacher registered', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};

export const signupVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const bundle = await authService.signupVendor(req.body);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(201).json({ success: true, data: bundle, message: 'Vendor registered', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password required', code: 'MISSING_FIELDS' });
      return;
    }
    const bundle = await authService.login(email, password);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(200).json({ success: true, data: bundle, message: 'Login successful', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('token');
  res.status(200).json({ success: true, data: { loggedOut: true }, message: 'Logged out', timestamp: new Date().toISOString() });
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const bundle = await authService.loadBundle(String(req.account.id));
  res.status(200).json({ success: true, data: bundle, timestamp: new Date().toISOString() });
};

export const validateToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || (req as any).cookies?.token;
    if (!token) {
      res.status(200).json({ success: true, data: { valid: false }, timestamp: new Date().toISOString() });
      return;
    }
    jwt.verify(token, JWT_CONFIG.secret);
    res.status(200).json({ success: true, data: { valid: true }, timestamp: new Date().toISOString() });
  } catch {
    res.status(200).json({ success: true, data: { valid: false }, timestamp: new Date().toISOString() });
  }
};

export const refreshToken = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const token = setAuthCookie(res, String(req.account.id), req.account.role);
  res.status(200).json({ success: true, data: { token }, message: 'Token refreshed', timestamp: new Date().toISOString() });
};
```

- [ ] **Step 4: Replace `routes/auth.ts`**

```ts
import express from 'express';
import {
  signupInstitute,
  signupTeacher,
  signupVendor,
  login,
  logout,
  me,
  validateToken,
  refreshToken,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/institute/signup', signupInstitute);
router.post('/teacher/signup', signupTeacher);
router.post('/vendor/signup', signupVendor);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.get('/validate', validateToken);
router.post('/refresh', authenticate, refreshToken);

export default router;
```

- [ ] **Step 5: Run integration test, confirm pass**

```bash
npm test -- tests/integration/auth.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Run full test suite — older tests will fail because controllers still reference old User shape**

```bash
npm test
```

Expected: auth tests pass, but `tsc` may complain about other controllers referencing `req.user`. That's fine for now — we fix it in Phase 10. To unblock, ensure `noEmit` mode is what's running (Vitest uses esbuild). Confirm no test files explicitly break.

- [ ] **Step 7: Commit**

```bash
git add controllers/authController.ts routes/auth.ts tests/integration/auth.test.ts
git commit -m "feat(auth): rewrite controller + routes for persona-specific signups + bundle response"
```

---

## Phase 9 — Mechanical ref renames in other models

### Task 10: Rename `ref: 'User'` to `ref: 'Account'` in all non-User models

**Files (all in `models/`):**
- `Vehicle.ts` — `sellerId`, `assistedBy`
- `Job.ts` — `instituteId`
- `Supplier.ts` — `createdBy`
- `Application.ts` — applicant fields (check file for exact field names)
- `Notification.ts` — recipient fields
- `Ad.ts` — owner/creator fields
- `Lead.ts` — owner/assignee fields
- `Task.ts` — owner/assignee fields
- `Activity.ts` — actor field
- `AuditLog.ts` — actor field
- `SubscriptionRequest.ts` — requester field

- [ ] **Step 1: Verify the full list of files containing `ref: 'User'`**

```bash
cd edufleetexchange/server
grep -rln "ref: *'User'" models/
```

Expected: a list of the 11 model files above (or whichever the grep actually returns — use that as your authoritative list).

- [ ] **Step 2: Run sed on the list**

```bash
cd edufleetexchange/server
grep -rln "ref: *'User'" models/ | xargs sed -i.bak "s/ref: *'User'/ref: 'Account'/g"
```

Then remove the `.bak` files:

```bash
find models/ -name '*.bak' -delete
```

- [ ] **Step 3: Verify no `ref: 'User'` remains**

```bash
grep -rn "ref: *'User'" models/
```

Expected: no output.

- [ ] **Step 4: Type-check**

```bash
cd edufleetexchange/server
npx tsc --noEmit
```

Expected: model-level rename should pass type-check (only the `ref:` string changed). If errors mention `populate('user')` or similar, those will be fixed in Phase 10.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: green (this rename doesn't affect runtime behaviour at the test level since tests don't yet exercise populates).

- [ ] **Step 6: Commit**

```bash
git add models/
git commit -m "refactor(models): rename ref: 'User' -> ref: 'Account' across all collections"
```

---

## Phase 10 — Controller updates

### Task 11: Update each controller's `req.user.X` → `req.account/profile/subscription.X`

This is mechanical but per-controller. The pattern: `req.user._id` / `req.user.id` → `req.account.id`; `req.user.role` → `req.account.role`; `req.user.subscription.X` → `req.subscription.X`; `req.user.qualifications` / `req.user.profile.X` → `req.profile.X`.

**Files (in `controllers/`):**
- `adController.ts`
- `adminController.ts`
- `crmController.ts`
- `jobController.ts`
- `marketingController.ts`
- `notificationController.ts`
- `personaAccessController.ts`
- `salesController.ts`
- `subscriptionController.ts`
- `supplierController.ts`
- `userController.ts` (will be deleted in Task 18 but needs to compile until then)
- `vehicleController.ts`

For each controller, follow the same recipe:

- [ ] **Step 1: For each controller in the list, list `req.user` occurrences**

```bash
cd edufleetexchange/server
for f in controllers/*.ts; do
  echo "=== $f ==="
  grep -n "req\.user" "$f" || echo "(none)"
done
```

- [ ] **Step 2: For each controller, apply the substitutions**

Per-controller, in your editor:
1. `req.user._id` → `req.account.id` (note: `id` not `_id` — the `toJSON` transform now exposes `id`)
2. `req.user.id` → `req.account.id`
3. `req.user.role` → `req.account.role`
4. `req.user.name` → `req.account.name`
5. `req.user.email` → `req.account.email`
6. `req.user.subscription` → `req.subscription`
7. `req.user.qualifications` / `req.user.subjects` / `req.user.experience` / `req.user.bio` / `req.user.location` / `req.user.isAvailable` → `req.profile.qualifications` etc.
8. `req.user.instituteName` / `req.user.contactPerson` / `req.user.address` → `req.profile.instituteName` etc.
9. `req.user.employeeId` → `req.profile.employeeId`
10. `req.user.profile.X` → `req.profile.X` (the nested-profile-on-user pattern collapses to flat profile)
11. Any `User.findById(...)` for the *current* user → `Account.findById(req.account.id)`. For arbitrary user lookups, **leave as Account lookup** — `User` is being deleted in Task 18.
12. Replace `import User from '../models/User.js'` → `import Account from '../models/Account.js'`. If the controller also needs profile data, add `import { loadBundle } from '../services/authService.js'`.

- [ ] **Step 3: Replace any `populate('user')` calls**

```bash
grep -rn "populate('user'" controllers/ models/
```

Each occurrence: `.populate('user')` → `.populate('account')` if the schema's ref was `User` → `Account`. Cross-check the field name being populated (e.g., `sellerId` is populated as `populate('sellerId')`, not `populate('user')`).

- [ ] **Step 4: Type-check repeatedly while editing**

After each controller, run:

```bash
npx tsc --noEmit
```

Until clean.

- [ ] **Step 5: Add a smoke test per touched controller**

Create `tests/integration/vehicles.test.ts` as a representative example:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JWT_CONFIG } from '../../config/jwt.js';
import vehicleRoutes from '../../routes/vehicles.js';
import * as authService from '../../services/authService.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/vehicles', vehicleRoutes);
  await SubscriptionPlan.create({
    name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true,
  });
});

describe('vehicles smoke (uses Account as seller)', () => {
  it('an authenticated institute can create a vehicle', async () => {
    const bundle = await authService.signupInstitute({
      name: 'X', email: 'veh@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = jwt.sign({ accountId: bundle.account.id, role: 'institute' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
    const res = await request(app)
      .post('/api/vehicles')
      .set('Cookie', [`token=${token}`])
      .send({
        title: 'Bus 1', manufacturer: 'TATA', vehicleModel: 'X', year: 2024, type: 'school-bus',
        price: 1000000, registrationNumber: 'KA01AB1234', mileage: 12, condition: 'good',
        features: [], images: ['x.jpg'], description: 'd',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.sellerId || res.body.data?.account?.id || res.body.sellerId).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run tests until green**

```bash
npm test
```

- [ ] **Step 7: Commit (per controller or one big commit — your call)**

```bash
git add controllers/ tests/integration/
git commit -m "refactor(controllers): replace req.user with req.account/profile/subscription"
```

---

## Phase 11 — New persona resources

### Task 12: Add `accountController` + `routes/accounts.ts`

**Files:**
- Create: `controllers/accountController.ts`
- Create: `routes/accounts.ts`
- Modify: `index.ts` (mount route)
- Create: `tests/integration/accounts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/accounts.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JWT_CONFIG } from '../../config/jwt.js';
import accountRoutes from '../../routes/accounts.js';
import * as authService from '../../services/authService.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;
beforeEach(async () => {
  app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/api/accounts', accountRoutes);
  await SubscriptionPlan.create({ name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30, features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true });
});

describe('PATCH /api/accounts/me', () => {
  it('updates name/phone/avatar on the current account', async () => {
    const b = await authService.signupInstitute({ name: 'Old', email: 'a@e.com', password: 'pwpwpw', instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' } });
    const token = jwt.sign({ accountId: b.account.id, role: 'institute' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
    const res = await request(app).patch('/api/accounts/me').set('Cookie', [`token=${token}`]).send({ name: 'New', phone: '+91999' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New');
    expect(res.body.data.phone).toBe('+91999');
  });

  it('does not let user change role via PATCH /accounts/me', async () => {
    const b = await authService.signupInstitute({ name: 'X', email: 'r@e.com', password: 'pwpwpw', instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' } });
    const token = jwt.sign({ accountId: b.account.id, role: 'institute' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
    const res = await request(app).patch('/api/accounts/me').set('Cookie', [`token=${token}`]).send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('institute');
  });
});
```

- [ ] **Step 2: Implement `controllers/accountController.ts`**

```ts
import { Response } from 'express';
import Account from '../models/Account.js';
import { AuthRequest } from '../middleware/auth.js';

const ALLOWED_PATCH_FIELDS = ['name', 'phone', 'avatar'] as const;

export const patchMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const updates: Record<string, any> = {};
  for (const k of ALLOWED_PATCH_FIELDS) {
    if (k in req.body) updates[k] = req.body[k];
  }
  const updated = await Account.findByIdAndUpdate(req.account.id, updates, { new: true });
  res.status(200).json({ success: true, data: updated, timestamp: new Date().toISOString() });
};

// Admin: list accounts
export const listAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  const { role, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (role) filter.role = role;
  const items = await Account.find(filter).skip((page - 1) * pageSize).limit(Number(pageSize)).sort({ createdAt: -1 });
  const total = await Account.countDocuments(filter);
  res.status(200).json({ success: true, data: { items, total, page: Number(page), pageSize: Number(pageSize), hasMore: page * pageSize < total }, timestamp: new Date().toISOString() });
};
```

- [ ] **Step 3: Implement `routes/accounts.ts`**

```ts
import express from 'express';
import { patchMe, listAccounts } from '../controllers/accountController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.patch('/me', authenticate, patchMe);
router.get('/', authenticate, requireRole('admin'), listAccounts);
export default router;
```

- [ ] **Step 4: Mount in `index.ts`**

Add to `index.ts` route imports:
```ts
import accountRoutes from './routes/accounts.js';
```
Add to route mounts:
```ts
app.use(`${apiPrefix}/accounts`, accountRoutes);
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
npm test -- tests/integration/accounts.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add controllers/accountController.ts routes/accounts.ts index.ts tests/integration/accounts.test.ts
git commit -m "feat(accounts): PATCH /accounts/me + admin list endpoint"
```

---

### Task 13: Add `teacherController` + `routes/teachers.ts`

**Files:**
- Create: `controllers/teacherController.ts`
- Create: `routes/teachers.ts`
- Modify: `index.ts` (mount route)
- Create: `tests/integration/teachers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/teachers.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import teacherRoutes from '../../routes/teachers.js';
import * as authService from '../../services/authService.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;
beforeEach(async () => {
  app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/api/teachers', teacherRoutes);
  await SubscriptionPlan.create({ name: 't-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30, features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true });
});

describe('GET /api/teachers', () => {
  it('returns teachers filtered by subject', async () => {
    await authService.signupTeacher({ name: 'A', email: 'a@e.com', password: 'pwpwpw', experience: 5, qualifications: [], subjects: ['Math'] });
    await authService.signupTeacher({ name: 'B', email: 'b@e.com', password: 'pwpwpw', experience: 5, qualifications: [], subjects: ['Physics'] });
    const res = await request(app).get('/api/teachers?subject=Math');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].account.name).toBe('A');
  });

  it('returns teachers filtered by minimum experience', async () => {
    await authService.signupTeacher({ name: 'L', email: 'l@e.com', password: 'pwpwpw', experience: 2, qualifications: [], subjects: ['Math'] });
    await authService.signupTeacher({ name: 'H', email: 'h@e.com', password: 'pwpwpw', experience: 8, qualifications: [], subjects: ['Math'] });
    const res = await request(app).get('/api/teachers?minExperience=5');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].account.name).toBe('H');
  });
});
```

- [ ] **Step 2: Implement `controllers/teacherController.ts`**

```ts
import { Request, Response } from 'express';
import TeacherProfile from '../models/TeacherProfile.js';

export const listTeachers = async (req: Request, res: Response): Promise<void> => {
  const { subject, minExperience, location, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (subject) filter.subjects = subject;
  if (minExperience) filter.experience = { $gte: Number(minExperience) };
  if (location) filter.location = location;

  const skip = (Number(page) - 1) * Number(pageSize);
  const profiles = await TeacherProfile.find(filter)
    .populate('accountId', 'name email avatar phone')
    .skip(skip)
    .limit(Number(pageSize))
    .sort({ createdAt: -1 });
  const total = await TeacherProfile.countDocuments(filter);

  const items = profiles.map((p: any) => ({
    profile: { id: p._id, experience: p.experience, qualifications: p.qualifications, subjects: p.subjects, bio: p.bio, location: p.location, isAvailable: p.isAvailable },
    account: p.accountId ? { id: p.accountId._id, name: p.accountId.name, email: p.accountId.email, avatar: p.accountId.avatar, phone: p.accountId.phone } : null,
  }));

  res.status(200).json({ success: true, data: { items, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + items.length < total }, timestamp: new Date().toISOString() });
};

export const getTeacher = async (req: Request, res: Response): Promise<void> => {
  const profile = await TeacherProfile.findById(req.params.id).populate('accountId', 'name email avatar phone');
  if (!profile) {
    res.status(404).json({ success: false, error: 'Teacher not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json({ success: true, data: profile, timestamp: new Date().toISOString() });
};
```

- [ ] **Step 3: Implement `routes/teachers.ts`**

```ts
import express from 'express';
import { listTeachers, getTeacher } from '../controllers/teacherController.js';

const router = express.Router();
router.get('/', listTeachers);
router.get('/:id', getTeacher);
export default router;
```

- [ ] **Step 4: Mount in `index.ts`**

Add import and `app.use(\`${apiPrefix}/teachers\`, teacherRoutes);`.

- [ ] **Step 5: Run tests, confirm pass**

```bash
npm test -- tests/integration/teachers.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add controllers/teacherController.ts routes/teachers.ts index.ts tests/integration/teachers.test.ts
git commit -m "feat(teachers): GET /teachers + GET /teachers/:id backed by TeacherProfile"
```

---

### Task 14: Add `instituteController` + `vendorController` + routes

**Files:**
- Create: `controllers/instituteController.ts`
- Create: `controllers/vendorController.ts`
- Create: `routes/institutes.ts`
- Create: `routes/vendors.ts`
- Modify: `index.ts`

These mirror the `teacherController` pattern (list + get) for the two remaining personas. Follow the same pattern as Task 13. No new test code is required beyond a smoke test per resource. For brevity, write small smoke tests that mirror the teacher test structure.

- [ ] **Step 1: Implement `controllers/instituteController.ts`**

```ts
import { Request, Response } from 'express';
import InstituteProfile from '../models/InstituteProfile.js';

export const listInstitutes = async (req: Request, res: Response): Promise<void> => {
  const { city, state, searchable, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (city) filter['address.city'] = city;
  if (state) filter['address.state'] = state;
  if (searchable !== undefined) filter.instituteSearchability = searchable === 'true';

  const skip = (Number(page) - 1) * Number(pageSize);
  const profiles = await InstituteProfile.find(filter)
    .populate('accountId', 'name email avatar phone')
    .skip(skip).limit(Number(pageSize)).sort({ createdAt: -1 });
  const total = await InstituteProfile.countDocuments(filter);

  res.status(200).json({ success: true, data: { items: profiles, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + profiles.length < total }, timestamp: new Date().toISOString() });
};

export const getInstitute = async (req: Request, res: Response): Promise<void> => {
  const profile = await InstituteProfile.findById(req.params.id).populate('accountId', 'name email avatar phone');
  if (!profile) {
    res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json({ success: true, data: profile, timestamp: new Date().toISOString() });
};
```

- [ ] **Step 2: Implement `controllers/vendorController.ts`**

```ts
import { Request, Response } from 'express';
import VendorProfile from '../models/VendorProfile.js';

export const listVendors = async (req: Request, res: Response): Promise<void> => {
  const { city, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (city) filter['address.city'] = city;

  const skip = (Number(page) - 1) * Number(pageSize);
  const profiles = await VendorProfile.find(filter)
    .populate('accountId', 'name email avatar phone')
    .skip(skip).limit(Number(pageSize)).sort({ createdAt: -1 });
  const total = await VendorProfile.countDocuments(filter);

  res.status(200).json({ success: true, data: { items: profiles, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + profiles.length < total }, timestamp: new Date().toISOString() });
};

export const getVendor = async (req: Request, res: Response): Promise<void> => {
  const profile = await VendorProfile.findById(req.params.id).populate('accountId', 'name email avatar phone');
  if (!profile) {
    res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json({ success: true, data: profile, timestamp: new Date().toISOString() });
};
```

- [ ] **Step 3: Create `routes/institutes.ts` and `routes/vendors.ts`**

```ts
// routes/institutes.ts
import express from 'express';
import { listInstitutes, getInstitute } from '../controllers/instituteController.js';
const router = express.Router();
router.get('/', listInstitutes);
router.get('/:id', getInstitute);
export default router;
```

```ts
// routes/vendors.ts
import express from 'express';
import { listVendors, getVendor } from '../controllers/vendorController.js';
const router = express.Router();
router.get('/', listVendors);
router.get('/:id', getVendor);
export default router;
```

- [ ] **Step 4: Mount in `index.ts`**

```ts
import instituteRoutes from './routes/institutes.js';
import vendorRoutes from './routes/vendors.js';

// in the registration block:
app.use(`${apiPrefix}/institutes`, instituteRoutes);
app.use(`${apiPrefix}/vendors`, vendorRoutes);
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests green.

- [ ] **Step 6: Commit**

```bash
git add controllers/instituteController.ts controllers/vendorController.ts routes/institutes.ts routes/vendors.ts index.ts
git commit -m "feat: add institute + vendor resource endpoints"
```

---

## Phase 12 — Delete legacy

### Task 15: Delete `User.ts`, `userController.ts`, `routes/users.ts`

**Files to delete:**
- `models/User.ts`
- `controllers/userController.ts`
- `routes/users.ts`

**Files to update:**
- `index.ts` (remove `import userRoutes` and the mount)
- `routes/auth.ts` (already updated in Task 9 — verify no leftover imports from userController)
- Any remaining `import ... from '../models/User.js'` across the codebase

- [ ] **Step 1: Confirm no remaining imports of User model or userController**

```bash
cd edufleetexchange/server
grep -rn "from '../models/User" .
grep -rn "from '../../models/User" .
grep -rn "userController" .
grep -rn "routes/users" .
```

Each match must be either inside the files about to be deleted, or fixed before deletion.

- [ ] **Step 2: Fix any remaining imports**

For each non-deleted file that still imports from `models/User.js` or `controllers/userController.js`, replace with the equivalent Account/profile/service import. Likely candidates:
- `controllers/authController.ts` (already updated in Task 9)
- Any test files that referenced the old model — update them.

- [ ] **Step 3: Delete the files**

```bash
rm models/User.ts controllers/userController.ts routes/users.ts
```

- [ ] **Step 4: Remove `userRoutes` from `index.ts`**

Delete the `import userRoutes from './routes/users.js';` line and the `app.use(\`${apiPrefix}/users\`, userRoutes);` line.

- [ ] **Step 5: Type-check and test**

```bash
npx tsc --noEmit
npm test
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: delete legacy User model, userController, routes/users"
```

---

## Phase 13 — Seed data rewrite

### Task 16: Rewrite `scripts/seedData/` for the new shape

**Files:**
- Modify: `scripts/seedData/users.ts` → rename to `scripts/seedData/accounts.ts`
- Create: `scripts/seedData/index.ts`
- Create: `scripts/seedData/reset.ts`
- Modify: `scripts/seedData/subscriptions.ts` (if it exists — verify) so plans get seeded before accounts
- Modify: `package.json` (replace `seed:users`)

- [ ] **Step 1: Verify existing seed scripts and plan**

```bash
ls scripts/seedData/
cat scripts/seedData/subscriptions.ts 2>/dev/null | head -30
```

- [ ] **Step 2: Write `scripts/seedData/reset.ts`**

```ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { ENV, connectDB, disconnectDB } from '../../config/index.js';

const COLLECTIONS_TO_TRUNCATE = [
  'accounts',
  'instituteprofiles',
  'teacherprofiles',
  'vendorprofiles',
  'staffprofiles',
  'subscriptions',
  'vehicles',
  'jobs',
  'suppliers',
  'applications',
  'notifications',
  'ads',
  'leads',
  'tasks',
  'activities',
  'auditlogs',
  'subscriptionrequests',
];

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');
  for (const name of COLLECTIONS_TO_TRUNCATE) {
    try {
      await db.collection(name).deleteMany({});
      console.log(`✓ truncated ${name}`);
    } catch (e) {
      console.warn(`! could not truncate ${name}`, e);
    }
  }
  await disconnectDB();
  console.log('✓ reset complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Write `scripts/seedData/accounts.ts`** (replaces `users.ts`)

```ts
import 'dotenv/config';
import { connectDB, disconnectDB } from '../../config/index.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import * as authService from '../../services/authService.js';
import Account from '../../models/Account.js';
import StaffProfile from '../../models/StaffProfile.js';

const DEFAULT_PASSWORD = 'password123';

async function ensureFreePlans() {
  const planSpecs: Array<['institute' | 'teacher' | 'vendor', string, string]> = [
    ['institute', 'institute-free', 'Institute Free'],
    ['teacher',   'teacher-free',   'Teacher Free'],
    ['vendor',    'vendor-free',    'Vendor Free'],
  ];
  for (const [planType, name, displayName] of planSpecs) {
    const exists = await SubscriptionPlan.findOne({ name });
    if (exists) continue;
    await SubscriptionPlan.create({
      name, displayName, planType,
      description: `${displayName} plan`,
      price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    });
    console.log(`✓ seeded plan ${name}`);
  }
}

async function seedExternalPersonas() {
  await authService.signupInstitute({
    name: 'Demo School', email: 'institute1@edufleet.test', password: DEFAULT_PASSWORD, phone: '+91...',
    instituteName: 'Demo Public School', contactPerson: 'A. Sharma',
    address: { street: '1 St', city: 'Bengaluru', state: 'KA', pincode: '560001', country: 'India' },
  });
  await authService.signupTeacher({
    name: 'R. Kumar', email: 'teacher1@edufleet.test', password: DEFAULT_PASSWORD, phone: '+91...',
    experience: 5, qualifications: ['M.Sc.', 'B.Ed.'], subjects: ['Math', 'Physics'], isAvailable: true,
  });
  await authService.signupVendor({
    name: 'Acme Books', email: 'vendor1@edufleet.test', password: DEFAULT_PASSWORD,
    businessName: 'Acme Books Pvt Ltd', contactPerson: 'V. Mehta', phone: '+91...',
  });
}

async function seedStaffAccount(opts: { email: string; name: string; role: 'admin' | 'marketing' | 'sales'; employeeId: string; department: string }) {
  const exists = await Account.findOne({ email: opts.email });
  if (exists) return;
  const account = await Account.create({
    name: opts.name, email: opts.email, password: DEFAULT_PASSWORD,
    role: opts.role, isActive: true, isVerified: true,
  });
  await StaffProfile.create({ accountId: account._id, employeeId: opts.employeeId, department: opts.department });
  console.log(`✓ seeded ${opts.role} ${opts.email}`);
}

async function main() {
  await connectDB();
  await ensureFreePlans();
  await seedExternalPersonas();
  await seedStaffAccount({ email: 'admin@edufleet.test',     name: 'Platform Admin',    role: 'admin',     employeeId: 'EMP-001', department: 'Platform' });
  await seedStaffAccount({ email: 'marketing1@edufleet.test', name: 'M. Patel',         role: 'marketing', employeeId: 'EMP-010', department: 'Marketing' });
  await seedStaffAccount({ email: 'sales1@edufleet.test',    name: 'S. Rao',            role: 'sales',     employeeId: 'EMP-020', department: 'Sales' });
  await disconnectDB();
  console.log('✓ seed complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Write `scripts/seedData/index.ts`** as a thin wrapper

```ts
import './accounts.js';
```

- [ ] **Step 5: Update `package.json` scripts**

Replace `seed:users` with:

```json
"seed": "tsx ./scripts/seedData/index.ts",
"seed:accounts": "tsx ./scripts/seedData/accounts.ts",
"seed:reset": "tsx ./scripts/seedData/reset.ts && npm run seed"
```

- [ ] **Step 6: Delete `scripts/seedData/users.ts`**

```bash
rm scripts/seedData/users.ts
```

- [ ] **Step 7: Smoke-run the seed against a local mongo**

```bash
npm run seed:reset
```

Expected: clean run with `✓ seed complete`. Manually verify in Mongo Compass / mongosh that you have `accounts`, `instituteprofiles`, `teacherprofiles`, `vendorprofiles`, `staffprofiles`, and `subscriptions` populated.

- [ ] **Step 8: Commit**

```bash
git add scripts/seedData/ package.json package-lock.json
git commit -m "refactor(seed): rewrite seedData for Account + persona profile model"
```

---

## Phase 14 — Frontend types

### Task 17: Update `src/api/types.ts` and `src/types/`

**Files (in UI repo):**
- Modify: `src/api/types.ts`
- Create: `src/types/profileGuards.ts` (narrow helpers)
- Modify: any file under `src/types/` that re-exports `User` (verify with grep first)

- [ ] **Step 1: Find references to the old `User` type**

```bash
cd edufleetexchange_ui
grep -rn "from '@/api/types'" src/ | grep "User"
grep -rn "interface User" src/
grep -rn "import { User" src/
```

- [ ] **Step 2: Replace the `User` interface in `src/api/types.ts`**

Find the existing block (lines 135-153 today):

```ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'guest' | 'institute' | 'admin' | 'teacher' | 'vendor' | 'marketing' | 'sales';
  // ...
}
```

Replace with:

```ts
export type AccountRole = 'institute' | 'teacher' | 'vendor' | 'admin' | 'marketing' | 'sales';

export interface Account {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstituteProfile {
  id: string;
  accountId: string;
  instituteName: string;
  contactPerson?: string;
  instituteSearchability: boolean;
  address: { street: string; city: string; state: string; pincode: string; country: string };
}

export interface TeacherProfile {
  id: string;
  accountId: string;
  experience: number;
  qualifications: string[];
  subjects: string[];
  bio?: string;
  location?: string;
  preferredLocation?: string[];
  currentInstitute?: string;
  achievements?: string[];
  isAvailable: boolean;
}

export interface VendorProfile {
  id: string;
  accountId: string;
  businessName: string;
  contactPerson?: string;
  phone?: string;
  website?: string;
  address?: { street?: string; city?: string; state?: string; pincode?: string; country?: string };
}

export interface StaffProfile {
  id: string;
  accountId: string;
  employeeId?: string;
  department?: string;
  permissions?: string[];
}

export type Profile = InstituteProfile | TeacherProfile | VendorProfile | StaffProfile;

export interface Subscription {
  id: string;
  accountId: string;
  planId?: string;
  status: 'active' | 'inactive' | 'suspended' | 'expired';
  paymentStatus: 'pending' | 'completed' | 'failed';
  transactionId?: string;
  startDate: string;
  endDate: string;
  listingsUsed: number;
  listingsLimit: number;
  jobPostsUsed: number;
  jobPostsLimit: number;
  browseCount: number;
  browseCountLimit: number;
  lastBrowseReset?: string;
  notes?: string;
}

export interface AuthBundle {
  account: Account;
  profile: Profile | null;
  subscription: Subscription | null;
}

// Legacy User type retained as a deprecated alias for incremental migration.
// Remove after all consumers updated.
/** @deprecated use Account + Profile instead */
export type User = Account & Partial<InstituteProfile & TeacherProfile & VendorProfile & StaffProfile> & {
  instituteName?: string;
  contactPerson?: string;
  experience?: number;
  qualifications?: string[];
  subjects?: string[];
  bio?: string;
  location?: string;
  isAvailable?: boolean;
  instituteSearchability?: boolean;
  employeeId?: string;
};

export interface AuthResponse {
  data: AuthBundle;
}

// Update LoginRequest: remove role (server determines from email lookup)
export interface LoginRequest {
  email: string;
  password: string;
}

// Update SignupRequest: split into persona-specific
export interface InstituteSignupRequest {
  name: string; email: string; password: string; phone?: string;
  instituteName: string; contactPerson?: string;
  address: { street: string; city: string; state: string; pincode: string; country?: string };
}

export interface TeacherSignupRequest {
  name: string; email: string; password: string; phone?: string;
  experience: number; qualifications: string[]; subjects: string[];
  bio?: string; location?: string; preferredLocation?: string[];
  isAvailable?: boolean;
}

export interface VendorSignupRequest {
  name: string; email: string; password: string; phone?: string;
  businessName: string; contactPerson?: string; website?: string;
  address?: { street?: string; city?: string; state?: string; pincode?: string; country?: string };
}
```

Notes: keep the `/** @deprecated */ User` type around for the duration of the migration. After Task 21 (consumer updates) is complete, delete it in a follow-up commit.

- [ ] **Step 3: Create `src/types/profileGuards.ts`**

```ts
import type { Profile, InstituteProfile, TeacherProfile, VendorProfile, StaffProfile, AccountRole } from '@/api/types';

export const isInstituteProfile = (p: Profile | null, role: AccountRole): p is InstituteProfile =>
  role === 'institute' && !!p && 'instituteName' in (p as any);

export const isTeacherProfile = (p: Profile | null, role: AccountRole): p is TeacherProfile =>
  role === 'teacher' && !!p && 'subjects' in (p as any);

export const isVendorProfile = (p: Profile | null, role: AccountRole): p is VendorProfile =>
  role === 'vendor' && !!p && 'businessName' in (p as any);

export const isStaffProfile = (p: Profile | null, role: AccountRole): p is StaffProfile =>
  ['admin', 'marketing', 'sales'].includes(role) && !!p;
```

- [ ] **Step 4: Type-check**

```bash
cd edufleetexchange_ui
npx tsc --noEmit
```

Expected: errors only in consumers — the spec acknowledges these will be fixed in Tasks 19-21. Verify the errors are about consumers, not about the types themselves.

- [ ] **Step 5: Commit**

```bash
git add src/api/types.ts src/types/profileGuards.ts
git commit -m "feat(types): add Account/Profile/Subscription types; deprecate User"
```

---

## Phase 15 — Frontend API services

### Task 18: Update `src/api/services/authService.ts` and `subscriptionService.ts`

**Files (in UI repo):**
- Modify: `src/api/services/authService.ts`
- Modify: `src/api/services/subscriptionService.ts`

- [ ] **Step 1: Read the existing services to understand current shape**

```bash
cd edufleetexchange_ui
cat src/api/services/authService.ts | head -120
cat src/api/services/subscriptionService.ts | head -80
```

- [ ] **Step 2: Rewrite the public surface of `authService.ts`**

Replace the file's exported functions with:

```ts
import { apiClient } from '@/lib/apiClient';
import type { AuthBundle, InstituteSignupRequest, TeacherSignupRequest, VendorSignupRequest, LoginRequest, Account } from '@/api/types';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function persist(bundle: AuthBundle, token?: string) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(bundle.account));
}

export const authService = {
  async signupInstitute(input: InstituteSignupRequest): Promise<AuthBundle> {
    const { data } = await apiClient.post('/auth/institute/signup', input);
    if (data?.data) persist(data.data, data.token);
    return data.data;
  },
  async signupTeacher(input: TeacherSignupRequest): Promise<AuthBundle> {
    const { data } = await apiClient.post('/auth/teacher/signup', input);
    if (data?.data) persist(data.data, data.token);
    return data.data;
  },
  async signupVendor(input: VendorSignupRequest): Promise<AuthBundle> {
    const { data } = await apiClient.post('/auth/vendor/signup', input);
    if (data?.data) persist(data.data, data.token);
    return data.data;
  },
  async login(input: LoginRequest): Promise<AuthBundle> {
    const { data } = await apiClient.post('/auth/login', input);
    if (data?.data) persist(data.data, data.token);
    return data.data;
  },
  async me(): Promise<AuthBundle | null> {
    try {
      const { data } = await apiClient.get('/auth/me');
      return data?.data ?? null;
    } catch {
      return null;
    }
  },
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },
  async validateToken(): Promise<boolean> {
    try {
      const { data } = await apiClient.get('/auth/validate');
      return Boolean(data?.data?.valid);
    } catch {
      return false;
    }
  },
  async updateAccount(updates: Partial<Pick<Account, 'name' | 'phone' | 'avatar'>>): Promise<Account> {
    const { data } = await apiClient.patch('/accounts/me', updates);
    return data.data;
  },
  getStoredToken(): string | null { return localStorage.getItem(TOKEN_KEY); },
  getStoredUser(): Account | null {
    const s = localStorage.getItem(USER_KEY);
    return s ? JSON.parse(s) : null;
  },
};

// Legacy exports for compatibility during migration. Remove after Task 21.
export type User = Account; // alias — consumers still importing `User` will compile
```

- [ ] **Step 3: Update `subscriptionService.ts` if it queries `/users/:id/subscription`**

Find any URL like `/users/${userId}/subscription` and replace with `/subscriptions/me` or `/accounts/${id}/subscription`. The exact server endpoint for "get my subscription" was the `/auth/me` bundle — so a dedicated `subscriptionService.getMine()` just calls `authService.me()` and returns `bundle.subscription`. Concretely:

```ts
import { authService } from './authService';

export async function getUserSubscription(_userId?: string) {
  const bundle = await authService.me();
  return { success: !!bundle, data: bundle?.subscription ?? null };
}
```

Replace any direct subscription fetches with this until a proper `/subscriptions/me` endpoint exists (which is a follow-up spec).

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: fewer errors than before; remaining errors are in consumers (next task).

- [ ] **Step 5: Commit**

```bash
git add src/api/services/authService.ts src/api/services/subscriptionService.ts
git commit -m "feat(ui-api): authService returns AuthBundle from new endpoints"
```

---

## Phase 16 — AuthContext rewrite

### Task 19: Rewrite `src/context/AuthContext.tsx`

**Files (in UI repo):**
- Modify: `src/context/AuthContext.tsx`

- [ ] **Step 1: Replace the full content of `src/context/AuthContext.tsx`**

```tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '@/api/services/authService';
import type { Account, Profile, Subscription, InstituteSignupRequest, TeacherSignupRequest, VendorSignupRequest } from '@/api/types';
import { toast } from 'sonner';

interface AuthContextType {
  account: Account | null;
  profile: Profile | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<Account>;
  signupInstitute: (input: InstituteSignupRequest) => Promise<void>;
  signupTeacher: (input: TeacherSignupRequest) => Promise<void>;
  signupVendor: (input: VendorSignupRequest) => Promise<void>;
  updateAccount: (updates: Partial<Pick<Account, 'name' | 'phone' | 'avatar'>>) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyBundle = useCallback((b: { account: Account; profile: Profile | null; subscription: Subscription | null } | null) => {
    setAccount(b?.account ?? null);
    setProfile(b?.profile ?? null);
    setSubscription(b?.subscription ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const bundle = await authService.me();
    applyBundle(bundle);
  }, [applyBundle]);

  useEffect(() => {
    (async () => {
      try {
        const token = authService.getStoredToken();
        if (token) {
          const bundle = await authService.me();
          applyBundle(bundle);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [applyBundle]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const bundle = await authService.login({ email, password });
      applyBundle(bundle);
      toast.success('Login successful');
      return bundle.account;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed';
      toast.error(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [applyBundle]);

  const signupInstitute = useCallback(async (input: InstituteSignupRequest) => {
    setIsLoading(true);
    try {
      const bundle = await authService.signupInstitute(input);
      applyBundle(bundle);
      toast.success('Institute signup successful');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Signup failed'); throw e;
    } finally { setIsLoading(false); }
  }, [applyBundle]);

  const signupTeacher = useCallback(async (input: TeacherSignupRequest) => {
    setIsLoading(true);
    try {
      const bundle = await authService.signupTeacher(input);
      applyBundle(bundle);
      toast.success('Teacher signup successful');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Signup failed'); throw e;
    } finally { setIsLoading(false); }
  }, [applyBundle]);

  const signupVendor = useCallback(async (input: VendorSignupRequest) => {
    setIsLoading(true);
    try {
      const bundle = await authService.signupVendor(input);
      applyBundle(bundle);
      toast.success('Vendor signup successful');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Signup failed'); throw e;
    } finally { setIsLoading(false); }
  }, [applyBundle]);

  const updateAccount = useCallback(async (updates: Partial<Pick<Account, 'name' | 'phone' | 'avatar'>>) => {
    const updated = await authService.updateAccount(updates);
    setAccount(updated);
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setAccount(null); setProfile(null); setSubscription(null);
      toast.success('Logged out');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      account, profile, subscription,
      isAuthenticated: !!account, isLoading,
      login, signupInstitute, signupTeacher, signupVendor,
      updateAccount, logout, refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: many errors in consumers — that's expected. We fix them in Task 21.

- [ ] **Step 3: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "refactor(ui-context): AuthContext exposes account/profile/subscription"
```

---

### Task 20: Add a Vitest unit test for `AuthContext`

**Files (in UI repo):**
- Modify: `package.json` (add Vitest)
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/context/AuthContext.test.tsx`

- [ ] **Step 1: Install Vitest + testing deps**

```bash
cd edufleetexchange_ui
npm install --save-dev vitest@^2.1.0 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.5.0 jsdom@^25.0.0
```

- [ ] **Step 2: Add scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Minimal localStorage shim if jsdom doesn't provide one
if (typeof window !== 'undefined' && !window.localStorage) {
  const store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
    writable: true,
  });
}

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
```

- [ ] **Step 5: Create `tests/context/AuthContext.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';

vi.mock('@/api/services/authService', () => ({
  authService: {
    me: vi.fn().mockResolvedValue(null),
    login: vi.fn(),
    signupInstitute: vi.fn(),
    signupTeacher: vi.fn(),
    signupVendor: vi.fn(),
    logout: vi.fn(),
    updateAccount: vi.fn(),
    getStoredToken: vi.fn().mockReturnValue(null),
  },
}));

function Display() {
  const { account, profile, subscription, isAuthenticated, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="name">{account?.name ?? 'none'}</span>
      <span data-testid="role">{account?.role ?? 'none'}</span>
      <span data-testid="profile">{profile ? 'yes' : 'no'}</span>
      <span data-testid="sub">{subscription ? subscription.status : 'no'}</span>
    </div>
  );
}

beforeEach(() => { localStorage.clear(); });

describe('AuthContext', () => {
  it('starts unauthenticated when no stored token', async () => {
    await act(async () => {
      render(<AuthProvider><Display /></AuthProvider>);
    });
    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(screen.getByTestId('name').textContent).toBe('none');
  });

  it('populates account/profile/subscription after login', async () => {
    const { authService } = await import('@/api/services/authService');
    (authService.login as any).mockResolvedValue({
      account: { id: '1', name: 'X', email: 'x@e.com', role: 'teacher', isActive: true, isVerified: true, createdAt: '', updatedAt: '' },
      profile: { id: 'p', accountId: '1', experience: 5, qualifications: [], subjects: ['Math'], isAvailable: true },
      subscription: { id: 's', accountId: '1', status: 'active', paymentStatus: 'completed', startDate: '', endDate: '', listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0 },
    });

    let api: any;
    function Capture() { api = useAuth(); return null; }

    await act(async () => {
      render(<AuthProvider><Capture /><Display /></AuthProvider>);
    });

    await act(async () => {
      await api.login('x@e.com', 'pwpwpw');
    });

    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(screen.getByTestId('role').textContent).toBe('teacher');
    expect(screen.getByTestId('profile').textContent).toBe('yes');
    expect(screen.getByTestId('sub').textContent).toBe('active');
  });
});
```

- [ ] **Step 6: Run tests, confirm pass**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/ package.json package-lock.json
git commit -m "test(ui): vitest setup + AuthContext unit tests"
```

---

## Phase 17 — Frontend consumer updates

### Task 21: Mechanical migration of `useAuth().user` → `useAuth().account/profile/subscription`

This is bulk find-and-replace across many pages and components. Work through them by category. After each category, type-check.

**Files (in UI repo) — categorized:**

**Pages — auth-touching:**
- `src/pages/Login.tsx`
- `src/pages/Signup.tsx`
- `src/pages/TeacherSignup.tsx`

**Pages — dashboards:**
- `src/pages/Dashboard.tsx`
- `src/pages/TeacherDashboard.tsx`
- `src/pages/MarketingDashboard.tsx`
- `src/pages/SalesDashboard.tsx`

**Pages — search:**
- `src/pages/InstituteTeacherSearch.tsx`
- `src/pages/TeacherSearch.tsx`

**Pages — admin and other:**
- `src/pages/admin/UserManagement.tsx` (likely rename to `AccountManagement.tsx` later — but keep filename for this pass to limit diff)
- All other admin pages that read `useAuth().user`

**Components:**
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/SubscriptionStatus.tsx`
- `src/components/SubscriptionUsageCard.tsx`
- `src/components/SubscriptionAlert.tsx`
- `src/components/JobListingForm.tsx`
- `src/components/ListingForm.tsx`

- [ ] **Step 1: Find every `useAuth()` consumer**

```bash
cd edufleetexchange_ui
grep -rn "useAuth()" src/ | grep -v test
```

This produces the authoritative file list.

- [ ] **Step 2: For each file, apply substitutions**

Pattern → replacement:

| Old | New |
|---|---|
| `const { user } = useAuth()` | `const { account, profile, subscription } = useAuth()` |
| `user.id` | `account.id` |
| `user._id` | `account.id` |
| `user.name` | `account.name` |
| `user.email` | `account.email` |
| `user.role` | `account.role` |
| `user.avatar` | `account.avatar` |
| `user.phone` | `account.phone` |
| `user.instituteName` | `(profile as InstituteProfile).instituteName` (with `isInstituteProfile(profile, account.role)` guard) |
| `user.contactPerson` | `(profile as InstituteProfile).contactPerson` |
| `user.qualifications` | `(profile as TeacherProfile).qualifications` |
| `user.subjects` | `(profile as TeacherProfile).subjects` |
| `user.experience` | `(profile as TeacherProfile).experience` |
| `user.bio` | `(profile as TeacherProfile).bio` |
| `user.location` | `(profile as TeacherProfile).location` |
| `user.isAvailable` | `(profile as TeacherProfile).isAvailable` |
| `user.subscription.listingsUsed` | `subscription?.listingsUsed` |
| `user.subscription.X` | `subscription?.X` |
| `user?.role` | `account?.role` |

For typed access to persona-specific fields, import the narrow helpers:
```ts
import { isInstituteProfile, isTeacherProfile, isVendorProfile } from '@/types/profileGuards';
```

- [ ] **Step 3: Update signup pages to call the new context methods**

In `Signup.tsx`: replace `await signup(...)` with `await signupInstitute({ name, email, password, instituteName, contactPerson, address, phone })`.

In `TeacherSignup.tsx`: replace `await signupTeacher(data)` — the form fields likely already match `TeacherSignupRequest`; verify and adjust.

If there's a vendor signup page, similarly call `signupVendor`.

- [ ] **Step 4: Update `ProtectedRoute.tsx`**

Replace `useAuth().user?.role` with `useAuth().account?.role`. If it checks subscription gating, use `useAuth().subscription`.

- [ ] **Step 5: Type-check after each batch**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Run the UI app in dev mode and smoke through login flows**

```bash
npm run dev
```

(in another terminal: `cd edufleetexchange/server && npm run dev`)

Open the browser, sign up an institute, log in, log out. Sign up a teacher. Log in as a teacher. Click around.

- [ ] **Step 7: Delete the `/** @deprecated */ User` type from `src/api/types.ts`**

After all consumers compile without `User`, remove it. Type-check confirms cleanliness:

```bash
grep -rn "import.*User.*from '@/api/types'" src/
```

Expected: no results (or only inside test files that explicitly reference legacy shape).

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "refactor(ui): migrate consumers from user to account/profile/subscription"
```

---

## Phase 18 — READMEs

### Task 22: Write real READMEs for both repos

**Files:**
- Modify: `edufleetexchange/README.md` (server repo)
- Modify: `edufleetexchange_ui/README.md` (UI repo)

- [ ] **Step 1: Write the server `README.md`**

```markdown
# eduFleet Exchange — Server

Backend API for the eduFleet Exchange platform: a marketplace for Indian K-12 institutes covering vehicles (school buses), teacher job listings, and education suppliers, monetised via per-persona subscription plans.

## Stack
- Node.js 20+, TypeScript (ESM)
- Express 5
- MongoDB via Mongoose 9
- JWT cookies + bcryptjs
- Vitest + supertest + mongodb-memory-server for tests

## Layout
- `models/` — Mongoose schemas (Account, persona profiles, Subscription, marketplace entities)
- `controllers/` — Express handlers
- `routes/` — Route mounting
- `services/` — Cross-document business logic (auth signup transactions, subscription quotas)
- `middleware/` — `authenticate`, `requireRole`, persona access, file upload
- `config/` — App config, DB connection, JWT, CORS
- `scripts/seedData/` — Dev data seeding (`npm run seed`)
- `tests/` — Vitest tests

## Run

```bash
npm install
cp .env.example .env  # fill in MONGO_URI, JWT_SECRET, etc.
npm run dev           # nodemon-style watch
npm test              # run tests
npm run seed:reset    # truncate + reseed default accounts
```

## Default seeded credentials (dev only)

| Email | Role | Password |
|---|---|---|
| admin@edufleet.test | admin | password123 |
| institute1@edufleet.test | institute | password123 |
| teacher1@edufleet.test | teacher | password123 |
| vendor1@edufleet.test | vendor | password123 |
| marketing1@edufleet.test | marketing | password123 |
| sales1@edufleet.test | sales | password123 |

## Architecture

See `docs/superpowers/specs/2026-05-24-user-decomposition-design.md` for the User decomposition design that drove the Account / Profile / Subscription split.
```

- [ ] **Step 2: Write the UI `README.md`**

```markdown
# eduFleet Exchange — UI

React + Vite frontend for the eduFleet Exchange platform.

## Stack
- React 19 + Vite 7 + TypeScript
- React Router 7
- Radix UI + shadcn/ui + Tailwind 3
- Axios
- Vitest + Testing Library for unit tests

## Layout
- `src/api/` — API services + types (Account, Profile, Subscription, marketplace types)
- `src/components/` — Reusable UI components
- `src/context/` — React contexts (Auth, Notification, Ad, Config)
- `src/hooks/` — Custom hooks
- `src/pages/` — Route pages (one per route)
- `src/lib/` — API client + utils
- `src/types/` — Type narrowing helpers (`isTeacherProfile`, etc.)

## Run

```bash
npm install
cp .env.frontend.example .env  # set VITE_API_URL
npm run dev                     # vite dev server (default :5173)
npm test                        # run vitest
```

## Connecting to the server

By default `VITE_API_URL=http://localhost:5000/api` matches `edufleetexchange/server`. Run the server first with `npm run dev` in that repo, then the UI.

## Architecture

The User decomposition spec lives in the server repo (canonical) at `edufleetexchange/docs/superpowers/specs/2026-05-24-user-decomposition-design.md`; a pointer copy lives at `docs/superpowers/specs/` in this repo.
```

- [ ] **Step 3: Commit (each repo separately)**

The server README lives at `edufleetexchange/README.md` (git root), not inside `server/`:

```bash
cd edufleetexchange
git add README.md
git commit -m "docs: real README for server repo"

cd ../edufleetexchange_ui
git add README.md
git commit -m "docs: real README for UI repo"
```

---

## Phase 19 — Smoke pass

### Task 23: End-to-end manual smoke test of all six personas

This is the only manual step in the plan. Run both repos, exercise the golden flows.

- [ ] **Step 1: Reset and reseed**

```bash
cd edufleetexchange/server
npm run seed:reset
```

- [ ] **Step 2: Start both servers**

```bash
# terminal 1
cd edufleetexchange/server && npm run dev

# terminal 2
cd edufleetexchange_ui && npm run dev
```

- [ ] **Step 3: Run through each persona's flow**

For each seeded persona, open the UI (default http://localhost:5173), log in with the credential from the seed table, and exercise:

| Persona | Flow |
|---|---|
| Institute | Login → Dashboard loads → create a vehicle listing → check it appears in own listings → post a job → search teachers |
| Teacher | Login → Teacher Dashboard loads → browse jobs → open a job → apply |
| Vendor | Login → see vendor dashboard (or whatever the role lands on) |
| Admin | Login at `/admin/login` → admin dashboard loads → list users (accounts) → list vehicles → toggle approval |
| Marketing | Login → marketing dashboard loads → CRM leads visible |
| Sales | Login → sales dashboard loads → leads/tasks visible |

For each flow, note any errors in the browser console or server logs. Common likely issues:
- Missed `req.user` reads in some controllers — produces 500 errors. Search and fix.
- UI components reading `user.X` instead of `account.X` — produces undefined fields. Fix at the consumer.

- [ ] **Step 4: Fix every issue surfaced**

For each bug:
1. Reproduce reliably.
2. Locate the offending file with grep (`grep -rn "req.user" controllers/` or `grep -rn "user\." src/pages/`).
3. Fix per the substitution table in Task 11 (server) or Task 21 (UI).
4. Re-run the flow.

- [ ] **Step 5: Run full test suite both sides green**

```bash
cd edufleetexchange/server && npm test
cd ../edufleetexchange_ui && npm test
```

- [ ] **Step 6: Final commit (if smoke surfaced fixes)**

```bash
git add -A
git commit -m "fix: smoke-pass corrections from user decomposition refactor"
```

- [ ] **Step 7: Tag the milestone (optional)**

```bash
git tag -a "v1.0.0-user-decomposition" -m "User god-schema decomposed into Account + Profiles + Subscription"
```

---

## Spec-coverage self-check

For each spec section, the corresponding task that implements it:

| Spec section | Implementing tasks |
|---|---|
| §2 Goal 1 (Account + 4 profiles) | Tasks 3, 4 |
| §2 Goal 2 (Subscription separated) | Task 5 |
| §2 Goal 3 (FK renames + read-site updates) | Tasks 10, 11 |
| §2 Goal 4 (JWT + middleware bundle) | Tasks 8, 9 |
| §2 Goal 5 (UI types + AuthContext) | Tasks 17, 19, 21 |
| §2 Goal 6 (Seeds) | Task 16 |
| §2 Goal 7 (Tests + infra) | Tasks 1, 2, 20 (each task includes its own tests) |
| §2 Goal 8 (Real READMEs) | Task 22 |
| §3 Data model | Tasks 3, 4, 5 |
| §4 Auth & request lifecycle | Tasks 6, 8, 9 |
| §5 API impact (response shape, persona endpoints, resource rename) | Tasks 9, 12, 13, 14 |
| §6 Server module layout (new services/, new routes, deletions) | Tasks 6, 7, 12-14, 15 |
| §7 Frontend impact | Tasks 17, 18, 19, 21 |
| §8 Seeding & dev data | Task 16 |
| §9 Testing strategy | Tasks 1, 2, 20 |
| §10 Rollout sequence | Plan task order mirrors spec rollout |
| §11 Open questions | Documented in spec; no plan task required (deferred) |

---

## Plan execution

Plan complete and saved to `edufleetexchange/docs/superpowers/plans/2026-05-24-user-decomposition.md`.
