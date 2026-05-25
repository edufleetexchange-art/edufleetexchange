import { describe, it, expect } from 'vitest';
import Account from '../../models/Account.js';
import Subscription from '../../models/Subscription.js';
import { incrementUsage, canConsume } from '../../services/subscriptionService.js';

async function setup(limits: { listings: number; jobs: number; browse: number }) {
  const a = await Account.create({
    name: 'X',
    email: `sub-${Date.now()}-${Math.random()}@e.com`,
    password: 'pwpwpw',
    role: 'institute',
  });
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
