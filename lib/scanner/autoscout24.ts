// AutoScout24 Belgium listing scanner.
// Fetches search result pages and extracts individual listing URLs.
// Best-effort: AS24 renders client-side so we attempt __NEXT_DATA__ extraction
// first, then fall back to static href parsing.

const MAKES = ['kia', 'hyundai', 'toyota', 'volkswagen', 'audi', 'bmw', 'mercedes'];

export type ScannedListing = {
  url: string;
};

export type ScanResult = {
  listings: ScannedListing[];
  total: number;
  error?: string;
};

export function buildSearchUrl(page = 1): string {
  const params = new URLSearchParams({
    atype: 'C',         // used cars
    fregfrom: '2021',   // year ≥ 2021
    kmto: '80000',      // km ≤ 80 000
    pricefrom: '12000', // price ≥ 12 000 €
    priceto: '20000',   // price ≤ 20 000 €
    gear: 'A',          // automatic
    cy: 'B',            // Belgium
    ...(page > 1 ? { pg: String(page) } : {}),
  });
  return `https://www.autoscout24.be/fr/lst/${MAKES.join(',')}/?${params.toString()}`;
}

function extractUrls(html: string): string[] {
  const found = new Set<string>();

  // Primary: parse __NEXT_DATA__ JSON blob (Next.js server-side props).
  const ndMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/i);
  if (ndMatch) {
    try {
      const ndStr = ndMatch[1];
      // Listing detail pages always have /fr/d/ in their path.
      const re = /"(\/fr\/d\/[^"\\]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(ndStr)) !== null) {
        found.add(`https://www.autoscout24.be${m[1]}`);
      }
    } catch {}
  }

  // Fallback: extract href="/fr/d/…" from static HTML.
  const hrefRe = /href="(\/fr\/d\/[^"?#]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    found.add(`https://www.autoscout24.be${m[1]}`);
  }

  // Also catch absolute URLs already present.
  const absRe = /"(https?:\/\/www\.autoscout24\.be\/fr\/d\/[^"?#\s]+)"/g;
  while ((m = absRe.exec(html)) !== null) {
    found.add(m[1]);
  }

  return Array.from(found).filter(
    (u) => !u.includes('/user/') && !u.includes('/dealership/') && u.length < 300,
  );
}

export async function scanAutoscout24(pages = 2): Promise<ScanResult> {
  const allUrls = new Set<string>();

  for (let page = 1; page <= pages; page++) {
    const searchUrl = buildSearchUrl(page);
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 15_000);

      const res = await fetch(searchUrl, {
        redirect: 'follow',
        signal: ac.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-BE,fr;q=0.9,nl-BE;q=0.8',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          Referer: 'https://www.autoscout24.be/fr/',
        },
      }).finally(() => clearTimeout(t));

      if (!res.ok) {
        if (page === 1) {
          return {
            listings: [],
            total: 0,
            error: `AutoScout24 a répondu HTTP ${res.status}. Le site bloque peut-être les robots.`,
          };
        }
        break;
      }

      const html = await res.text();
      const urls = extractUrls(html);
      urls.forEach((u) => allUrls.add(u));
    } catch (err: unknown) {
      if (page === 1) {
        const msg = err instanceof Error ? err.message : 'Timeout ou refus de connexion.';
        return { listings: [], total: 0, error: `Impossible de contacter AutoScout24 : ${msg}` };
      }
      break;
    }

    // Polite inter-page delay.
    if (page < pages) await new Promise((r) => setTimeout(r, 1_500));
  }

  const listings = Array.from(allUrls).map((url) => ({ url }));
  return { listings, total: listings.length };
}
