import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getGarantieDossier, addGarantieDocument } from 'app/db';
import { sendEmail } from '@/lib/email';

function textToHtml(text: string, customerName: string | null): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped.split('\n\n').map(p =>
    `<p style="margin:0 0 12px;color:#e4e4e7;line-height:1.6">${p.replace(/\n/g, '<br/>')}</p>`
  ).join('');
  return `
<div style="font-family:sans-serif;max-width:600px;margin:auto">
  <div style="background:#18181b;color:#fafafa;padding:20px 24px;border-radius:12px 12px 0 0;border-bottom:2px solid #3f3f46">
    <h1 style="margin:0;font-size:18px;font-weight:600">GP-CARS</h1>
    <p style="margin:4px 0 0;color:#a1a1aa;font-size:13px">Service Après-Vente · info.gpcars@gmail.com</p>
  </div>
  <div style="background:#27272a;padding:24px;border-radius:0 0 12px 12px">
    ${paragraphs}
    <hr style="border:none;border-top:1px solid #3f3f46;margin:20px 0"/>
    <p style="margin:0;color:#71717a;font-size:12px">
      GP-CARS · Belgique · info.gpcars@gmail.com
    </p>
  </div>
</div>`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body?.dossierId) return NextResponse.json({ error: 'dossierId requis.' }, { status: 400 });

  const dossier = await getGarantieDossier(Number(body.dossierId), email);
  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 });

  const type = body.type ?? 'email'; // 'email' | 'refus' | 'transaction'
  const textMap: Record<string, string | null> = {
    email:       dossier.communicationEmail,
    refus:       dossier.communicationRefus,
    transaction: dossier.communicationTransaction,
    whatsapp:    dossier.communicationWhatsapp,
  };
  const subjectMap: Record<string, string> = {
    email:       `GP-CARS · Votre dossier garantie`,
    refus:       `GP-CARS · Réponse à votre demande de garantie`,
    transaction: `GP-CARS · Proposition de règlement amiable`,
    whatsapp:    `GP-CARS · Message`,
  };

  const text = textMap[type];
  if (!text) return NextResponse.json({ error: 'Communication non générée. Lancez d\'abord l\'analyse IA.' }, { status: 400 });

  // WhatsApp text: show as-is (not sendable by email API, just log it)
  if (type === 'whatsapp') {
    return NextResponse.json({ ok: false, error: 'WhatsApp doit être envoyé manuellement depuis votre téléphone.' }, { status: 400 });
  }

  const to = body.overrideEmail ?? dossier.customerEmail;
  if (!to) return NextResponse.json({ error: 'Pas d\'email client dans le dossier. Ajoutez un email client avant d\'envoyer.' }, { status: 400 });

  const result = await sendEmail({
    to,
    subject: subjectMap[type] ?? 'GP-CARS · Garantie',
    html: textToHtml(text, dossier.customerName),
    replyTo: 'info.gpcars@gmail.com',
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Erreur envoi email.' }, { status: 500 });
  }

  // Archive the sent communication as a document
  await addGarantieDocument(dossier.id, email, {
    type: 'email',
    title: `Email envoyé — ${subjectMap[type]} (${new Date().toLocaleDateString('fr-BE')})`,
    description: `Destinataire : ${to}`,
    addedBy: 'garage',
  });

  return NextResponse.json({ ok: true, sentTo: to });
}
