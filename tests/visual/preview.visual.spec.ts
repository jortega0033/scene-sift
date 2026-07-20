import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual preview', () => {
  test('preview no-project state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.previewNotAvailable));
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByTestId('preview-not-available')).toBeVisible();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('preview-no-project.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('preview prerequisites state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.previewNoCues));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByTestId('preview-not-available')).toBeVisible();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('preview-prerequisites.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('preview ready state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.previewReady));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByTestId('preview-cue-list')).toBeVisible();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('preview-ready.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
