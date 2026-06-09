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

/**
 * Atomically reserve one unit of quota. Returns true if the slot was claimed
 * (used was strictly less than limit and was incremented in the same DB op);
 * false if either no active subscription exists or the limit was already hit.
 *
 * Replaces the check-then-act pattern (`canConsume` → create resource →
 * `incrementUsage`) which is a TOCTOU race: two concurrent requests both pass
 * the check and both bump the counter past the limit. With this single
 * `findOneAndUpdate({ used: { $lt: '$limit' } }, { $inc: { used: 1 } })`, only
 * one wins; the other gets a clean "limit reached" response.
 *
 * Callers must call `releaseReservation` if the downstream resource create
 * fails — otherwise the slot stays held.
 */
export async function tryConsume(accountId: string, key: QuotaKey): Promise<boolean> {
  const used = USED_FIELD[key];
  const limit = LIMIT_FIELD[key];
  // limit === 0 means unlimited per existing semantics. We translate that into
  // "always pass" by also matching limit === 0 in the filter; the increment
  // still runs (it's harmless to track usage even when unlimited).
  const result = await Subscription.findOneAndUpdate(
    {
      accountId,
      status: 'active',
      $expr: {
        $or: [
          { $eq: [`$${limit}`, 0] },
          { $lt: [`$${used}`, `$${limit}`] },
        ],
      },
    },
    { $inc: { [used]: 1 } },
    { new: false }
  );
  return result !== null;
}

/**
 * Refund a previously-claimed quota slot. Use after `tryConsume` succeeded but
 * the downstream resource creation failed — otherwise the user permanently
 * loses a slot they never used.
 */
export async function releaseReservation(accountId: string, key: QuotaKey): Promise<void> {
  await Subscription.updateOne(
    { accountId, status: 'active' },
    { $inc: { [USED_FIELD[key]]: -1 } }
  );
}
