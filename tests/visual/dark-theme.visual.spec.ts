import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual dark theme', () => {
  test('dark theme — app shell (projects page)', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.darkMultipleProjects));
    await page.waitForSelector('html.dark');
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('dark-app-shell.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('dark theme — settings page', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.darkMultipleProjects));
    await page.waitForSelector('html.dark');
    await page.getByRole('button', { name: 'Settings' }).click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('dark-settings.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
