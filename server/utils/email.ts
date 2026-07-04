import { Resend } from 'resend';

// API-based email via Resend — reliable on serverless (no SMTP sockets from
// short-lived functions). Configure with:
//   RESEND_API_KEY — from the Resend dashboard
//   EMAIL_FROM     — verified sender, e.g. "eduFleet Exchange <noreply@edufleetexchange.com>"
const FROM = process.env.EMAIL_FROM ?? 'eduFleet Exchange <noreply@edufleetexchange.com>';

async function send(to: string, subject: string, text: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // In test/dev without a key, log instead of failing
    console.warn(`[email] no RESEND_API_KEY; skipped "${subject}" → ${to}`);
    return;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: FROM, to, subject, text, html });
  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await send(
    to,
    'Reset your eduFleet Exchange password',
    `Click this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`,
    `<p>Click <a href="${resetUrl}">this link</a> to reset your password.</p><p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
  );
}

/**
 * Demand-alert match → the subscriber (school/consultant): "the teacher you
 * asked for just became available." This is the platform's core retention
 * hook — it must reach people who don't log in daily.
 */
export async function sendAlertMatchEmail(
  to: string,
  opts: { alertLabel: string; matchLabel: string; subjects: string; link: string },
): Promise<void> {
  await send(
    to,
    `Match found: ${opts.alertLabel}`,
    `Good news — ${opts.matchLabel} (${opts.subjects}) matches your alert "${opts.alertLabel}".\n\nView and contact: ${opts.link}\n\nYou set this alert on eduFleet Exchange; manage alerts at ${opts.link.split('/').slice(0, 3).join('/')}/alerts`,
    `<p>Good news — <b>${opts.matchLabel}</b> (${opts.subjects}) matches your alert "<b>${opts.alertLabel}</b>".</p>` +
      `<p><a href="${opts.link}">View and contact them now</a> — good candidates go fast.</p>` +
      `<p style="color:#888;font-size:13px">You set this alert on eduFleet Exchange.</p>`,
  );
}

/** Demand-alert match → the founder/admin: a concierge placement lead. */
export async function sendDemandLeadEmail(
  to: string,
  opts: { alertLabel: string; matchLabel: string; subjects: string },
): Promise<void> {
  await send(
    to,
    `Demand lead: ${opts.alertLabel}`,
    `Alert "${opts.alertLabel}" just matched ${opts.matchLabel} (${opts.subjects}). Reach out to the requester and close the placement.`,
    `<p>Alert "<b>${opts.alertLabel}</b>" just matched <b>${opts.matchLabel}</b> (${opts.subjects}).</p><p>Reach out to the requester and close the placement.</p>`,
  );
}
