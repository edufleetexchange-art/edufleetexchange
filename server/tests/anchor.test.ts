import { describe, it, expect } from 'vitest';

// Anchor test: intentionally fails until Task 6 (authService.login) is implemented.
// When Task 6 lands, this test is replaced with an assertion that actually exercises
// the login bundle. Do NOT delete or "fix" this test as part of any earlier task.
describe('auth bundle shape (anchor)', () => {
  it('login response contract is { account, profile, subscription }', () => {
    const expectedKeys = ['account', 'profile', 'subscription'].sort();
    const actual: string[] = []; // populated by Task 6
    expect(actual.sort(), 'INTENTIONAL FAILURE — implement in Task 6').toEqual(expectedKeys);
  });
});
