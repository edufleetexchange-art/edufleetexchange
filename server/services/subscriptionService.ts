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
