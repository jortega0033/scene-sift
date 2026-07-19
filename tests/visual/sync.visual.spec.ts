import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual sync panel', () => {
  test('sync not-available state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncNotAvailable));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('sync-not-available.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('sync ready-to-check state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncReadyToCheck));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('sync-ready-to-check.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('sync timing-ok state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncTimingOk));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('sync-timing-ok.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('sync needs-review state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncNeedsReview));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('sync-needs-review.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('sync check-failed state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncCheckFailed));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('sync-check-failed.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('sync stale state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncStale));
    await page.getByTestId('project-row').first().click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('sync-stale.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
