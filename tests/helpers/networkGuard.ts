import type { Page } from '@playwright/test';

const allowedHosts = new Set(['127.0.0.1', 'localhost']);

export const attachNetworkGuard = (page: Page) => {
  const violations: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!allowedHosts.has(url.hostname)) {
      violations.push(`[request] ${request.method()} ${request.url()}`);
    }
  });

  page.on('requestfailed', (request) => {
    try {
      const url = new URL(request.url());
      if (!allowedHosts.has(url.hostname)) {
        violations.push(
          `[requestfailed] ${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`,
        );
      }
    } catch {
      // Malformed URL — ignore
    }
  });

  return {
    assertNoViolations: () => {
      if (violations.length > 0) {
        throw new Error(`Unexpected network activity:\n${violations.join('\n')}`);
      }
    },
  };
};
