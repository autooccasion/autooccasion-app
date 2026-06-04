// Server-side helper to read a vehicle listing from its URL so Carmelo can
// cross-check the stated criteria against the real ad.
//
// IMPORTANT: many platforms render listings with JavaScript and/or block bots
// (anti-scraping). This best-effort reader works on server-rendered pages and
// degrades gracefully — when it can't read enough, the caller falls back to the
// text the user pasted. We restrict fetching to known automotive domains to
// avoid being used as an arbitrary URL fetcher (SSRF surface).

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
  // Block obvious internal / private targets.
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
        "Lien non pris en charge. Plateformes acceptées : AutoScout24, Gocar, 2dehands/2ememain, mobile.de.",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(rawUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'fr-BE,fr;q=0.9,nl;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { ok: false, error: `La page a renvoyé une erreur (HTTP ${res.status}).` };
    }

    const html = await res.text();
    const text = htmlToText(html).slice(0, 6000);

    if (text.length < 200) {
      return {
        ok: false,
        error:
          "Contenu illisible (page protégée ou chargée en JavaScript). Collez le texte de l'annonce.",
      };
    }

    return { ok: true, text };
  } catch {
    return {
      ok: false,
      error: "Impossible de lire le lien. Collez le texte de l'annonce.",
    };
  }
}
