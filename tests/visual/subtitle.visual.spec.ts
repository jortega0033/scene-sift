import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual subtitle panel', () => {
  test('subtitle not-selected state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleNotSelected));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('subtitle-not-selected.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('subtitle ready state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleReady));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('subtitle-ready.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('subtitle ready-with-warnings state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleReadyWithWarnings));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('subtitle-ready-with-warnings.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('subtitle parse-failed state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleParseFailed));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('subtitle-parse-failed.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
