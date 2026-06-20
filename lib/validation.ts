// Lightweight input validation helpers — no external dependency.

export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Returns a trimmed non-empty string or throws. */
export function requireString(
  v: unknown,
  field: string,
  opts: { maxLength?: number } = {},
): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new ValidationError(field, `${field} est requis et doit être une chaîne non vide.`);
  }
  const s = v.trim();
  if (opts.maxLength && s.length > opts.maxLength) {
    throw new ValidationError(field, `${field} dépasse la longueur maximale (${opts.maxLength}).`);
  }
  return s;
}

/** Returns a positive integer or throws. */
export function requirePositiveInt(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(field, `${field} doit être un entier positif.`);
  }
  return n;
}

/** Returns a positive integer, or null if absent/invalid. */
export function optionalPositiveInt(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Returns a trimmed string or null if absent/empty. */
export function optionalString(v: unknown, opts: { maxLength?: number } = {}): string | null {
  if (typeof v !== 'string' || v.trim().length === 0) return null;
  const s = v.trim();
  return opts.maxLength && s.length > opts.maxLength ? s.slice(0, opts.maxLength) : s;
}

/** Asserts that body is a non-null object. */
export function assertBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('body', 'Corps de requête invalide ou manquant.');
  }
}

/** Wraps a route handler to return a 400 response on ValidationError. */
export function withValidation<T>(
  fn: () => Promise<T>,
  onError: (err: ValidationError) => T,
): Promise<T> {
  return fn().catch((err) => {
    if (err instanceof ValidationError) return onError(err);
    throw err;
  });
}

/** Validates a 17-character VIN number format (ISO 3779). */
export function validateVin(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim().length === 0) return null;
  const vin = v.trim().toUpperCase();
  if (vin.length !== 17) return null;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return null;
  return vin;
}

/** Validates a vehicle km reading (0 to 999999). */
export function validateKm(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 999999) return null;
  return n;
}
