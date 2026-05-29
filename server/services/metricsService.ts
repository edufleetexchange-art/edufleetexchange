import Account from '../models/Account.js';
import Subscription from '../models/Subscription.js';
import Vehicle from '../models/Vehicle.js';
import Job from '../models/Job.js';
import Supplier from '../models/Supplier.js';
import Application from '../models/Application.js';
import AuditLog from '../models/AuditLog.js';

// ---------------------------------------------------------------------------
// Helper: generate an array of date strings "YYYY-MM-DD" for the last N days
// ---------------------------------------------------------------------------
function generateDays(days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400e3);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: pivot raw aggregate [{_id:{day, role}, count}] into daily rows
// ---------------------------------------------------------------------------
const ROLES = ['institute', 'teacher', 'vendor', 'admin', 'marketing', 'sales'] as const;
type RoleKey = (typeof ROLES)[number];

interface DayRoleCount {
  _id: { day: string; role: string };
  count: number;
}

interface SignupRow {
  date: string;
  institute: number;
  teacher: number;
  vendor: number;
  admin: number;
  marketing: number;
  sales: number;
}

function pivotByDay(docs: DayRoleCount[], days: number): SignupRow[] {
  const map = new Map<string, Partial<Record<RoleKey, number>>>();
  for (const doc of docs) {
    const { day, role } = doc._id;
    if (!map.has(day)) map.set(day, {});
    (map.get(day) as any)[role] = doc.count;
  }

  return generateDays(days).map((date) => {
    const entry = map.get(date) ?? {};
    return {
      date,
      institute: entry.institute ?? 0,
      teacher: entry.teacher ?? 0,
      vendor: entry.vendor ?? 0,
      admin: entry.admin ?? 0,
      marketing: entry.marketing ?? 0,
      sales: entry.sales ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Helper: pivot funnel aggregation into daily rows
// ---------------------------------------------------------------------------
interface FunnelDoc {
  _id: { day: string; type: 'vehicle' | 'supplier'; status: string };
  count: number;
}

interface FunnelRow {
  date: string;
  vehicleSubmitted: number;
  vehicleApproved: number;
  vehicleRejected: number;
  supplierSubmitted: number;
  supplierApproved: number;
  supplierRejected: number;
}

function pivotFunnelByDay(docs: FunnelDoc[], days: number): FunnelRow[] {
  // key: "date|type|status" -> count
  const map = new Map<string, number>();
  for (const doc of docs) {
    const key = `${doc._id.day}|${doc._id.type}|${doc._id.status}`;
    map.set(key, doc.count);
  }

  return generateDays(days).map((date) => ({
    date,
    vehicleSubmitted: map.get(`${date}|vehicle|pending`) ?? 0,
    vehicleApproved: map.get(`${date}|vehicle|approved`) ?? 0,
    vehicleRejected: map.get(`${date}|vehicle|rejected`) ?? 0,
    supplierSubmitted: map.get(`${date}|supplier|pending`) ?? 0,
    supplierApproved: map.get(`${date}|supplier|approved`) ?? 0,
    supplierRejected: map.get(`${date}|supplier|rejected`) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Helper: pivot DAU aggregation into daily rows
// ---------------------------------------------------------------------------
interface DauDoc {
  _id: string; // day "YYYY-MM-DD"
  count: number;
}

interface DauRow {
  date: string;
  activeUsers: number;
}

function pivotDauByDay(docs: DauDoc[], days: number): DauRow[] {
  const map = new Map<string, number>();
  for (const doc of docs) {
    map.set(doc._id, doc.count);
  }
  return generateDays(days).map((date) => ({
    date,
    activeUsers: map.get(date) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------
export async function summary() {
  const [
    accountTotal,
    accountsByRoleRaw,
    subActive,
    subExpired,
    subPending,
    vehicleTotal,
    vehiclePending,
    vehicleApproved,
    jobTotal,
    jobActive,
    jobClosed,
    supplierTotal,
    supplierPending,
    supplierApproved,
    appTotal,
    appPending,
    appShortlisted,
    appAccepted,
    appRejected,
  ] = await Promise.all([
    Account.countDocuments(),
    Account.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Subscription.countDocuments({ status: 'active' }),
    Subscription.countDocuments({ status: 'expired' }),
    Subscription.countDocuments({ paymentStatus: 'pending' }),
    Vehicle.countDocuments(),
    Vehicle.countDocuments({ status: 'pending' }),
    Vehicle.countDocuments({ status: 'approved' }),
    Job.countDocuments(),
    Job.countDocuments({ status: 'active' }),
    Job.countDocuments({ status: 'closed' }),
    Supplier.countDocuments(),
    Supplier.countDocuments({ status: 'pending' }),
    Supplier.countDocuments({ status: 'approved' }),
    Application.countDocuments(),
    Application.countDocuments({ status: 'pending' }),
    Application.countDocuments({ status: 'shortlisted' }),
    Application.countDocuments({ status: 'accepted' }),
    Application.countDocuments({ status: 'rejected' }),
  ]);

  const byRole: Record<string, number> = {};
  for (const r of accountsByRoleRaw) {
    byRole[r._id as string] = r.count as number;
  }

  return {
    accounts: {
      total: accountTotal,
      byRole: {
        institute: byRole.institute ?? 0,
        teacher: byRole.teacher ?? 0,
        vendor: byRole.vendor ?? 0,
        admin: byRole.admin ?? 0,
        marketing: byRole.marketing ?? 0,
        sales: byRole.sales ?? 0,
      },
    },
    subscriptions: {
      active: subActive,
      expired: subExpired,
      paymentPending: subPending,
    },
    listings: {
      vehicles: { total: vehicleTotal, pending: vehiclePending, approved: vehicleApproved },
      jobs: { total: jobTotal, active: jobActive, closed: jobClosed },
      suppliers: { total: supplierTotal, pending: supplierPending, approved: supplierApproved },
    },
    applications: {
      total: appTotal,
      pending: appPending,
      shortlisted: appShortlisted,
      accepted: appAccepted,
      rejected: appRejected,
    },
  };
}

// ---------------------------------------------------------------------------
// signupsByDay
// ---------------------------------------------------------------------------
export async function signupsByDay(days: number) {
  const since = new Date(Date.now() - days * 86400e3);

  const docs = await Account.aggregate<DayRoleCount>([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          role: '$role',
        },
        count: { $sum: 1 },
      },
    },
  ]);

  return { items: pivotByDay(docs, days) };
}

// ---------------------------------------------------------------------------
// approvalFunnel
// ---------------------------------------------------------------------------
export async function approvalFunnel(days: number) {
  const since = new Date(Date.now() - days * 86400e3);

  const [vehicleDocs, supplierDocs] = await Promise.all([
    Vehicle.aggregate<{ _id: { day: string; status: string }; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Supplier.aggregate<{ _id: { day: string; status: string }; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // Shape into unified FunnelDoc format
  const unified: FunnelDoc[] = [
    ...vehicleDocs.map((d) => ({
      _id: { day: d._id.day, type: 'vehicle' as const, status: d._id.status },
      count: d.count,
    })),
    ...supplierDocs.map((d) => ({
      _id: { day: d._id.day, type: 'supplier' as const, status: d._id.status },
      count: d.count,
    })),
  ];

  return { items: pivotFunnelByDay(unified, days) };
}

// ---------------------------------------------------------------------------
// activeUsers (DAU)
// Using AuditLog.userId — it is written on every admin/sales/marketing action
// and covers more user types than Activity (which is CRM-specific).
// ---------------------------------------------------------------------------
export async function activeUsers(days: number) {
  const since = new Date(Date.now() - days * 86400e3);

  const docs = await AuditLog.aggregate<DauDoc>([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          user: '$userId',
        },
      },
    },
    {
      $group: {
        _id: '$_id.day',
        count: { $sum: 1 },
      },
    },
  ]);

  return { items: pivotDauByDay(docs, days) };
}
