import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual projects', () => {
  test('projects empty state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.noProjects));
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('projects-empty.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('projects populated state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.multipleProjects));
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('projects-populated.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
