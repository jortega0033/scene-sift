import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 800, height: 700 },
];

test.describe('desktop viewport matrix', () => {
  for (const viewport of viewports) {
    test(`remains usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(fixtureUrl(FIXTURES.multipleProjects));
      await expect(page.getByTestId('app-shell')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create project' })).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasHorizontalOverflow).toBe(false);
    });
  }
});
