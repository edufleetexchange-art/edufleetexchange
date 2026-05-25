import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    : undefined,
});

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!process.env.SMTP_HOST) {
    // In test/dev without SMTP, log instead of failing
    console.warn('[email] no SMTP_HOST; logging reset link instead:', resetUrl);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_USER ?? 'noreply@edufleetexchange.com',
    to,
    subject: 'Reset your eduFleet Exchange password',
    text: `Click this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`,
    html: `<p>Click <a href="${resetUrl}">this link</a> to reset your password.</p><p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
  });
}
