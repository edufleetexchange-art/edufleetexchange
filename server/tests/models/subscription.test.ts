import { describe, it, expect } from 'vitest';
import Account from '../../models/Account.js';
import Subscription from '../../models/Subscription.js';

async function makeAccount() {
  return Account.create({
    name: 'X',
    email: `s-${Date.now()}-${Math.random()}@e.com`,
    password: 'pwpwpw',
    role: 'institute',
  });
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
    await Subscription.create({
      accountId: a._id, status: 'expired', paymentStatus: 'completed',
      startDate: new Date(), endDate: new Date(),
      listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0,
    });
    await Subscription.create({
      accountId: a._id, status: 'expired', paymentStatus: 'completed',
      startDate: new Date(), endDate: new Date(),
      listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0,
    });
    const count = await Subscription.countDocuments({ accountId: a._id });
    expect(count).toBe(2);
  });

  it('enforces only one active subscription per account', async () => {
    const a = await makeAccount();
    await Subscription.create({
      accountId: a._id, status: 'active', paymentStatus: 'completed',
      startDate: new Date(), endDate: new Date(),
      listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0,
    });
    await expect(
      Subscription.create({
        accountId: a._id, status: 'active', paymentStatus: 'completed',
        startDate: new Date(), endDate: new Date(),
        listingsUsed: 0, listingsLimit: 0, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0,
      })
    ).rejects.toThrow();
  });

  it('atomic increment on listingsUsed', async () => {
    const a = await makeAccount();
    await Subscription.create({
      accountId: a._id, status: 'active', paymentStatus: 'completed',
      startDate: new Date(), endDate: new Date(),
      listingsUsed: 0, listingsLimit: 100, jobPostsUsed: 0, jobPostsLimit: 0, browseCount: 0, browseCountLimit: 0,
    });
    await Promise.all(
      Array.from({ length: 10 }).map(() =>
        Subscription.updateOne({ accountId: a._id, status: 'active' }, { $inc: { listingsUsed: 1 } })
      )
    );
    const s = await Subscription.findOne({ accountId: a._id, status: 'active' });
    expect(s!.listingsUsed).toBe(10);
  });
});
