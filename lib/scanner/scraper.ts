// Shared HTTP fetch that routes through ScraperAPI when SCRAPERAPI_KEY is set.
//
// ScraperAPI spins a real headless Chrome, rotates residential proxies and
// handles anti-bot countermeasures — essential for JavaScript-rendered pages
// like AutoScout24.  Without a key the helper falls back to a direct fetch
// (best-effort, suitable for server-rendered pages or dev use).
//
// Set SCRAPERAPI_KEY in Vercel environment variables to enable.
// Sign up at https://scraperapi.com  — free tier: 5 000 credits/month
// (each render=true call costs 5 credits → 1 000 rendered pages/month free).

const SCRAPERAPI_ENDPOINT = 'https://api.scraperapi.com';

export type PageFetchResult = {
  ok: boolean;
  html?: string;
  via?: 'scraperapi' | 'direct';
  error?: string;
};

export async function fetchPage(
  targetUrl: string,
  options: {
    render?: boolean;
    countryCode?: string;
    timeoutMs?: number;
  } = {},
): Promise<PageFetchResult> {
  const { render = true, countryCode = 'be', timeoutMs = 25_000 } = options;
  const apiKey = process.env.SCRAPERAPI_KEY;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    let url: string;
    let headers: Record<string, string> = {};

    if (apiKey) {
      const params = new URLSearchParams({
        api_key: apiKey,
        url: targetUrl,
        render: render ? 'true' : 'false',
        country_code: countryCode,
      });
      url = `${SCRAPERAPI_ENDPOINT}?${params.toString()}`;
    } else {
      url = targetUrl;
      headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-BE,fr;q=0.9,nl-BE;q=0.8',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        Referer: 'https://www.autoscout24.be/fr/',
      };
    }

    const res = await fetch(url, {
      redirect: 'follow',
      signal: ac.signal,
      headers,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return {
        ok: false,
        via: apiKey ? 'scraperapi' : 'direct',
        error: `HTTP ${res.status}${!apiKey ? ' — AutoScout24 bloque les robots. Configurez SCRAPERAPI_KEY.' : ''}`,
      };
    }

    const html = await res.text();
    return { ok: true, html, via: apiKey ? 'scraperapi' : 'direct' };
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'Erreur réseau.';
    return {
      ok: false,
      via: apiKey ? 'scraperapi' : 'direct',
      error: msg,
    };
  }
}
