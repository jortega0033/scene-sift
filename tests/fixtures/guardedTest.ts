import { test as base, expect } from '@playwright/test';
import { attachConsoleGuard } from '../helpers/consoleGuard';
import { attachNetworkGuard } from '../helpers/networkGuard';

export const test = base.extend({
  page: async ({ page }, use) => {
    const consoleGuard = attachConsoleGuard(page);
    const networkGuard = attachNetworkGuard(page);
    await use(page);
    consoleGuard.assertNoViolations();
    networkGuard.assertNoViolations();
  },
});

export { expect };
