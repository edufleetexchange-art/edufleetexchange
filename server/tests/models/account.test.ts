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
    await Account.create({ name: 'A', email: 'dup@example.com', password: 'xxxxxx', role: 'teacher' });
    await expect(
      Account.create({ name: 'B', email: 'dup@example.com', password: 'yyyyyy', role: 'vendor' })
    ).rejects.toThrow();
  });

  it('lowercases email on save', async () => {
    const a = await Account.create({ name: 'X', email: 'MiXeD@Example.com', password: 'pppppp', role: 'institute' });
    expect(a.email).toBe('mixed@example.com');
  });

  it('comparePassword works', async () => {
    const a = await Account.create({ name: 'X', email: 'cmp@example.com', password: 'mypass', role: 'institute' });
    const fresh: any = await Account.findById(a._id).select('+password');
    expect(await fresh.comparePassword('mypass')).toBe(true);
    expect(await fresh.comparePassword('wrong')).toBe(false);
  });
});
