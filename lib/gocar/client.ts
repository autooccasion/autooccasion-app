// GoCar B2B Data API client — stub ready for integration.
// Contact: data@gocar.be to obtain GOCAR_API_KEY.
// GoCar tracks ~200k Belgian vehicles in near-real-time.
//
// Once you have credentials, set in Vercel:
//   GOCAR_API_KEY = your_key
//   GOCAR_API_URL = https://api.gocar.be/v1  (confirm URL with GoCar)

export type GocarComparable = {
  id: string;
  make: string;
  model: string;
  year: number;
  km: number;
  fuel: string;
  gearbox: string;
  price: number;
  publishedAt: string;
  url?: string;
  region?: string;
};

export type GocarSearchParams = {
  make: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  kmMax?: number;
  fuel?: string;
  gearbox?: string;
  limit?: number;
};

export type GocarResult =
  | { ok: true; comparables: GocarComparable[]; source: 'gocar' }
  | { ok: false; error: string };

export async function fetchGocarComparables(params: GocarSearchParams): Promise<GocarResult> {
  const apiKey = process.env.GOCAR_API_KEY;
  const baseUrl = process.env.GOCAR_API_URL ?? 'https://api.gocar.be/v1';

  if (!apiKey) {
    return { ok: false, error: 'GOCAR_API_KEY non configurée. Contactez data@gocar.be.' };
  }

  const qs = new URLSearchParams({
    make: params.make,
    ...(params.model     ? { model: params.model }         : {}),
    ...(params.yearMin   ? { year_min: String(params.yearMin) } : {}),
    ...(params.yearMax   ? { year_max: String(params.yearMax) } : {}),
    ...(params.kmMax     ? { km_max:   String(params.kmMax) }   : {}),
    ...(params.fuel      ? { fuel:     params.fuel }            : {}),
    ...(params.gearbox   ? { gearbox:  params.gearbox }         : {}),
    limit: String(params.limit ?? 20),
    country: 'BE',
  });

  try {
    const res = await fetch(`${baseUrl}/listings/comparables?${qs}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `GoCar API: ${res.status} ${body.slice(0, 200)}` };
    }

    const data = await res.json();
    // Adapt field mapping once the real API response format is confirmed with GoCar.
    const comparables: GocarComparable[] = (data.results ?? data.listings ?? data ?? []).map(
      (item: Record<string, unknown>) => ({
        id:          String(item.id ?? ''),
        make:        String(item.make ?? item.brand ?? ''),
        model:       String(item.model ?? ''),
        year:        Number(item.year ?? item.registration_year ?? 0),
        km:          Number(item.km ?? item.mileage ?? 0),
        fuel:        String(item.fuel ?? item.fuel_type ?? ''),
        gearbox:     String(item.gearbox ?? item.transmission ?? ''),
        price:       Number(item.price ?? item.asking_price ?? 0),
        publishedAt: String(item.published_at ?? item.created_at ?? ''),
        url:         item.url ? String(item.url) : undefined,
        region:      item.region ? String(item.region) : undefined,
      }),
    );

    return { ok: true, comparables, source: 'gocar' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur réseau GoCar.';
    return { ok: false, error: msg };
  }
}
