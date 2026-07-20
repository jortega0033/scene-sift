import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual transcript', () => {
  test('transcript not-available state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptNotAvailable));
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('transcript-not-available')).toBeVisible();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('transcript-not-available.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('transcript ready state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptReady));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('transcript-entry-list')).toBeVisible();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('transcript-ready.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('transcript ready-with-warnings state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptReadyWithWarnings));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('subtitle-warning-banner')).toBeVisible();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('transcript-with-warnings.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
