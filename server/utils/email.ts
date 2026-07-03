import { Resend } from 'resend';

// API-based email via Resend — reliable on serverless (no SMTP sockets from
// short-lived functions). Configure with:
//   RESEND_API_KEY — from the Resend dashboard
//   EMAIL_FROM     — verified sender, e.g. "eduFleet Exchange <noreply@edufleetexchange.com>"
const FROM = process.env.EMAIL_FROM ?? 'eduFleet Exchange <noreply@edufleetexchange.com>';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // In test/dev without a key, log instead of failing
    console.warn('[email] no RESEND_API_KEY; logging reset link instead:', resetUrl);
    return;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your eduFleet Exchange password',
    text: `Click this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`,
    html: `<p>Click <a href="${resetUrl}">this link</a> to reset your password.</p><p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
  });
  if (error) {
    throw new Error(`Failed to send reset email: ${error.message}`);
  }
}
