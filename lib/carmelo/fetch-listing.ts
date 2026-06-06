// Server-side helper to read a vehicle listing from its URL so Carmelo can
// cross-check the stated criteria against the real ad.
//
// Uses ScraperAPI (headless Chrome + rotating proxies) when SCRAPERAPI_KEY is
// set in the environment — strongly recommended for AutoScout24 which blocks
// plain bots.  Without a key, falls back to a direct fetch (works on
// server-rendered pages, degrades gracefully on JS-only platforms).
//
// SSRF protection: only the whitelisted automotive domains are allowed as
// targets, regardless of which transport is used.

import { fetchPage } from '@/lib/scanner/scraper';

const ALLOWED_HOST_SUFFIXES = [
  'autoscout24.be', 'autoscout24.com', 'autoscout24.fr', 'autoscout24.nl', 'autoscout24.de',
  'gocar.be',
  '2dehands.be', '2ememain.be',
  'automobile.be', 'autotrader.be',
  'mobile.de',
];

export function isAllowedListingUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return false;
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, d) => {
      const code = parseInt(d, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export type ListingFetchResult = {
  ok: boolean;
  text?: string;
  error?: string;
};

export async function fetchListing(rawUrl: string): Promise<ListingFetchResult> {
  if (!isAllowedListingUrl(rawUrl)) {
    return {
      ok: false,
      error:
        'Lien non pris en charge. Plateformes acceptées : AutoScout24, Gocar, 2dehands/2ememain, mobile.de.',
    };
  }

  const result = await fetchPage(rawUrl, { render: true, countryCode: 'be', timeoutMs: 25_000 });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "Impossible de lire le lien. Collez le texte de l'annonce.",
    };
  }

  const text = htmlToText(result.html!).slice(0, 6000);

  if (text.length < 200) {
    return {
      ok: false,
      error:
        "Contenu illisible (page protégée ou chargée en JavaScript). " +
        (process.env.SCRAPERAPI_KEY
          ? "ScraperAPI actif mais le contenu est insuffisant — vérifiez le lien."
          : "Configurez SCRAPERAPI_KEY pour activer le rendu JavaScript, ou collez le texte de l'annonce."),
    };
  }

  return { ok: true, text };
}
