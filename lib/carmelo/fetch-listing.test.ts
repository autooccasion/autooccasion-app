import { describe, it, expect } from 'vitest';
import { isAllowedListingUrl, htmlToText } from './fetch-listing';

describe('isAllowedListingUrl', () => {
  it('accepts known automotive platforms', () => {
    expect(isAllowedListingUrl('https://www.autoscout24.be/offres/kia-stonic-123')).toBe(true);
    expect(isAllowedListingUrl('https://gocar.be/fr/occasion/xyz')).toBe(true);
    expect(isAllowedListingUrl('https://www.2dehands.be/v/autos/kia/abc')).toBe(true);
  });

  it('rejects unknown or internal hosts', () => {
    expect(isAllowedListingUrl('https://example.com/car')).toBe(false);
    expect(isAllowedListingUrl('http://localhost:3000/admin')).toBe(false);
    expect(isAllowedListingUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
  });

  it('rejects non-http protocols and garbage', () => {
    expect(isAllowedListingUrl('ftp://autoscout24.be/x')).toBe(false);
    expect(isAllowedListingUrl('not a url')).toBe(false);
  });
});

describe('htmlToText', () => {
  it('strips tags, scripts and decodes entities', () => {
    const html = '<html><head><style>.a{}</style></head><body><script>x()</script><h1>Kia Stonic</h1><p>17&nbsp;500&euro; &amp; garantie</p></body></html>';
    const text = htmlToText(html);
    expect(text).toContain('Kia Stonic');
    expect(text).toContain('17 500€');
    expect(text).toContain('& garantie');
    expect(text).not.toContain('x()');
    expect(text).not.toContain('<h1>');
  });
});
