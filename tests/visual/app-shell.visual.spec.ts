import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test('@visual app shell', async ({ page }) => {
  await page.goto(fixtureUrl(FIXTURES.multipleProjects));
  await waitForStableUi(page);
  await expect(page).toHaveScreenshot('app-shell.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
});
