import type { Page } from '@playwright/test';

export const waitForStableUi = async (page: Page): Promise<void> => {
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.innerHTML = ':root { color-scheme: light; }';
    document.head.append(style);
  });
};
