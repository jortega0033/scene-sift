// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isAllowedUrl } from '@main/security/navigation';
import { pathToFileURL } from 'node:url';

describe('navigation security', () => {
  it('allows only local renderer file root in production mode', () => {
    const allowedRoot = '/app/dist/renderer';
    const allowedUrl = `${pathToFileURL(allowedRoot).toString()}/index.html`;
    const disallowedUrl = 'file:///etc/passwd';

    expect(isAllowedUrl(allowedUrl, undefined, allowedRoot)).toBe(true);
    expect(isAllowedUrl(disallowedUrl, undefined, allowedRoot)).toBe(false);
  });

  it('allows dev server origin and blocks others', () => {
    expect(isAllowedUrl('http://localhost:5173/', 'http://localhost:5173')).toBe(true);
    expect(isAllowedUrl('http://localhost:5173.evil.com/', 'http://localhost:5173')).toBe(false);
    expect(isAllowedUrl('https://example.com', 'http://localhost:5173')).toBe(false);
  });
});
