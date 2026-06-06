// AutoScout24 Belgium listing scanner.
// Fetches search result pages and extracts individual listing URLs.
// Uses ScraperAPI (headless Chrome) when SCRAPERAPI_KEY is set;
// otherwise falls back to a direct fetch (may be blocked by AS24's anti-bot).

import { fetchPage } from './scraper';

const MAKES = ['kia', 'hyundai', 'toyota', 'volkswagen', 'audi', 'bmw', 'mercedes'];

export type ScannedListing = {
  url: string;
};

export type ScanResult = {
  listings: ScannedListing[];
  total: number;
  via?: string;
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
      const re = /"(\/fr\/d\/[^"\\]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(ndStr)) !== null) {
        found.add(`https://www.autoscout24.be${m[1]}`);
      }
    } catch {}
  }

  // Fallback: extract href="/fr/d/…" from rendered HTML.
  const hrefRe = /href="(\/fr\/d\/[^"?#]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    found.add(`https://www.autoscout24.be${m[1]}`);
  }

  // Also catch absolute URLs.
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
  let via: string | undefined;

  for (let page = 1; page <= pages; page++) {
    const searchUrl = buildSearchUrl(page);
    const result = await fetchPage(searchUrl, { render: true, countryCode: 'be', timeoutMs: 25_000 });
    via = result.via;

    if (!result.ok) {
      if (page === 1) {
        return { listings: [], total: 0, via: result.via, error: result.error };
      }
      break;
    }

    const urls = extractUrls(result.html!);
    urls.forEach((u) => allUrls.add(u));

    // Polite inter-page delay.
    if (page < pages) await new Promise((r) => setTimeout(r, 1_500));
  }

  const listings = Array.from(allUrls).map((url) => ({ url }));
  return { listings, total: listings.length, via };
}
