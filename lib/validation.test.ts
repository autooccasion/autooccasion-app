import { describe, it, expect } from 'vitest';
import {
  requireString,
  requirePositiveInt,
  optionalPositiveInt,
  optionalString,
  assertBody,
  ValidationError,
} from './validation';

describe('requireString', () => {
  it('returns the trimmed string', () => {
    expect(requireString('  hello  ', 'field')).toBe('hello');
  });

  it('throws on empty string', () => {
    expect(() => requireString('  ', 'name')).toThrow(ValidationError);
  });

  it('throws on non-string', () => {
    expect(() => requireString(42, 'name')).toThrow(ValidationError);
  });

  it('throws when string exceeds maxLength', () => {
    expect(() => requireString('abcde', 'name', { maxLength: 3 })).toThrow(ValidationError);
  });

  it('accepts string at exactly maxLength', () => {
    expect(requireString('abc', 'name', { maxLength: 3 })).toBe('abc');
  });
});

describe('requirePositiveInt', () => {
  it('returns a valid positive integer', () => {
    expect(requirePositiveInt(42, 'id')).toBe(42);
    expect(requirePositiveInt('7', 'id')).toBe(7);
  });

  it('throws on zero', () => {
    expect(() => requirePositiveInt(0, 'id')).toThrow(ValidationError);
  });

  it('throws on negative', () => {
    expect(() => requirePositiveInt(-5, 'id')).toThrow(ValidationError);
  });

  it('throws on float', () => {
    expect(() => requirePositiveInt(1.5, 'id')).toThrow(ValidationError);
  });
});

describe('optionalPositiveInt', () => {
  it('returns null for absent/empty values', () => {
    expect(optionalPositiveInt(null)).toBeNull();
    expect(optionalPositiveInt(undefined)).toBeNull();
    expect(optionalPositiveInt('')).toBeNull();
  });

  it('returns the integer for valid input', () => {
    expect(optionalPositiveInt(100)).toBe(100);
    expect(optionalPositiveInt('250')).toBe(250);
  });

  it('returns null for invalid numeric strings', () => {
    expect(optionalPositiveInt('abc')).toBeNull();
    expect(optionalPositiveInt(0)).toBeNull();
  });
});

describe('optionalString', () => {
  it('returns null for blank or absent', () => {
    expect(optionalString(null)).toBeNull();
    expect(optionalString('')).toBeNull();
    expect(optionalString('   ')).toBeNull();
  });

  it('trims and returns the value', () => {
    expect(optionalString('  hello  ')).toBe('hello');
  });

  it('truncates when maxLength is set', () => {
    expect(optionalString('abcde', { maxLength: 3 })).toBe('abc');
  });
});

describe('assertBody', () => {
  it('does not throw for a plain object', () => {
    expect(() => assertBody({ key: 'value' })).not.toThrow();
  });

  it('throws for null', () => {
    expect(() => assertBody(null)).toThrow(ValidationError);
  });

  it('throws for an array', () => {
    expect(() => assertBody([])).toThrow(ValidationError);
  });

  it('throws for a string', () => {
    expect(() => assertBody('text')).toThrow(ValidationError);
  });
});
