import type { Page } from '@playwright/test';

const defaultAllowedConsolePatterns = [/Download the React DevTools/i];

export const attachConsoleGuard = (page: Page, allowedPatterns = defaultAllowedConsolePatterns) => {
  const violations: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') {
      return;
    }
    const text = message.text();
    const allowed = allowedPatterns.some((pattern) => pattern.test(text));
    if (!allowed) {
      violations.push(`[console.${message.type()}] ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    violations.push(`[pageerror] ${error.message}`);
  });

  return {
    assertNoViolations: () => {
      if (violations.length > 0) {
        throw new Error(`Unexpected console/page errors:\n${violations.join('\n')}`);
      }
    },
  };
};
