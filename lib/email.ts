// Resend email sender — raw fetch, no SDK dependency.

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

const FROM = process.env.RESEND_FROM_EMAIL ?? 'GP-CARS <notifications@gp-cars.be>';

export async function sendEmail(opts: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY non configurée.' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Erreur inconnue');
    return { ok: false, error: err };
  }
  return { ok: true };
}
