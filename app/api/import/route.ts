import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { bulkImportVehicles } from 'app/db';
import type { ImportRow } from 'app/db';

// CSV column mapping (French headers → ImportRow keys).
const COL_MAP: Record<string, keyof ImportRow> = {
  marque:         'make',
  modele:         'model',
  modèle:         'model',
  annee:          'year',
  année:          'year',
  km:             'km',
  kilometrage:    'km',
  kilométrage:    'km',
  carburant:      'fuel',
  boite:          'gearbox',
  boîte:          'gearbox',
  couleur:        'color',
  prix_demande:   'askingPrice',
  prix_demandé:   'askingPrice',
  prix_achat_reel:'realBuyPrice',
  prix_achat_réel:'realBuyPrice',
  prix_vente_reel:'realSellPrice',
  prix_vente_réel:'realSellPrice',
  jours_en_stock: 'soldInDays',
  date_achat:     'boughtAt',
  date_vente:     'soldAt',
  statut:         'status',
  url_annonce:    'listingUrl',
};

const VALID_STATUSES = new Set([
  'prospect', 'analyse', 'achete', 'en_stock', 'publie', 'vendu', 'refuse',
]);

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// Parse a CSV string into rows of key→value objects.
// Handles: BOM, CRLF, quoted fields (including commas inside quotes), semicolon separator.
function parseCsv(raw: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip UTF-8 BOM if present.
  const text = raw.startsWith('﻿') ? raw.slice(1) : raw;
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Detect separator from the first non-empty line.
  const firstLine = lines.find((l) => l.trim() !== '') ?? '';
  const sep = firstLine.includes(';') ? ';' : ',';

  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuote = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === sep) { fields.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const [headerLine, ...dataLines] = lines.filter((l) => l.trim() !== '');
  const rawHeaders = splitLine(headerLine ?? '');
  const headers = rawHeaders.map(normalizeHeader);

  const rows: Record<string, string>[] = [];
  for (const line of dataLines) {
    const vals = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function toNum(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: string | undefined): Date | null {
  if (!v) return null;
  // Accept DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY.
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}`);
  const eu = v.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})$/);
  if (eu) return new Date(`${eu[3]}-${eu[2]}-${eu[1]}`);
  return null;
}

function mapRow(raw: Record<string, string>, idx: number): { row: ImportRow; error?: string } {
  const mapped: Partial<ImportRow> & { make?: string } = {};
  for (const [rawKey, val] of Object.entries(raw)) {
    const key = COL_MAP[rawKey];
    if (!key || !val) continue;
    switch (key) {
      case 'make':
      case 'model':
      case 'fuel':
      case 'gearbox':
      case 'color':
      case 'listingUrl':
        (mapped as Record<string, unknown>)[key] = val;
        break;
      case 'status':
        (mapped as Record<string, unknown>)[key] = val.toLowerCase().replace(/\s+/g, '_');
        break;
      case 'year':
      case 'km':
      case 'askingPrice':
      case 'realBuyPrice':
      case 'realSellPrice':
      case 'soldInDays':
        (mapped as Record<string, unknown>)[key] = toNum(val);
        break;
      case 'boughtAt':
      case 'soldAt':
        (mapped as Record<string, unknown>)[key] = toDate(val);
        break;
    }
  }

  if (!mapped.make) return { row: mapped as ImportRow, error: `Ligne ${idx + 2}: colonne "marque" manquante.` };

  const status = (mapped.status as string | undefined) ?? 'analyse';
  if (!VALID_STATUSES.has(status)) {
    return { row: mapped as ImportRow, error: `Ligne ${idx + 2}: statut "${status}" invalide.` };
  }

  return { row: { ...mapped, make: mapped.make, status: status as ImportRow['status'] } as ImportRow };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  const email = session.user.email;

  let csvText: string;
  const ct = req.headers.get('content-type') ?? '';

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
    }
    csvText = await (file as File).text();
  } else {
    // Fallback: raw CSV body.
    csvText = await req.text();
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: 'Fichier vide.' }, { status: 400 });
  }

  const { rows: rawRows } = parseCsv(csvText);
  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'Aucune donnée trouvée dans le fichier.' }, { status: 400 });
  }
  if (rawRows.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 lignes par import.' }, { status: 400 });
  }

  const importRows: ImportRow[] = [];
  const parseErrors: { row: number; error: string }[] = [];

  rawRows.forEach((r, i) => {
    const { row, error } = mapRow(r, i);
    if (error) { parseErrors.push({ row: i + 2, error }); }
    else { importRows.push(row); }
  });

  if (importRows.length === 0) {
    return NextResponse.json({ imported: 0, errors: parseErrors }, { status: 422 });
  }

  const result = await bulkImportVehicles(email, importRows);
  return NextResponse.json({
    imported: result.imported,
    errors: [...parseErrors, ...result.errors],
    total: rawRows.length,
  });
}
