import crypto from 'crypto';
import Account from '../models/Account.js';
import PasswordResetToken from '../models/PasswordResetToken.js';

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function createResetToken(email: string): Promise<{ rawToken: string; account: any } | null> {
  const account = await Account.findOne({ email: email.toLowerCase() });
  if (!account) return null;
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  await PasswordResetToken.create({
    accountId: account._id,
    tokenHash,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return { rawToken: raw, account };
}

export async function consumeResetToken(rawToken: string, newPassword: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!rawToken || newPassword.length < 6) {
    return { ok: false, reason: 'invalid_request' };
  }
  const tokenHash = hashToken(rawToken);
  const tokenDoc = await PasswordResetToken.findOne({ tokenHash });
  if (!tokenDoc) return { ok: false, reason: 'token_not_found' };
  if (tokenDoc.usedAt) return { ok: false, reason: 'token_already_used' };
  if (tokenDoc.expiresAt < new Date()) return { ok: false, reason: 'token_expired' };
  const account = await Account.findById(tokenDoc.accountId).select('+password');
  if (!account) return { ok: false, reason: 'account_not_found' };
  (account as any).password = newPassword;
  await account.save();
  tokenDoc.usedAt = new Date();
  await tokenDoc.save();
  return { ok: true };
}
