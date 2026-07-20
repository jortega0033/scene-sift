import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('preview page', () => {
  test('shows select-project message when no project selected', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.previewNotAvailable));
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByTestId('preview-not-available')).toBeVisible();
    await expect(page.getByText('Select a project to preview')).toBeVisible();
  });

  test('shows prerequisite list when project lacks subtitle', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.previewNoCues));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByTestId('preview-not-available')).toBeVisible();
    await expect(page.getByText('Subtitle parsed')).toBeVisible();
  });

  test('shows cue list when prerequisites met', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.previewReady));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByTestId('preview-page')).toBeVisible();
    await expect(page.getByTestId('preview-not-available')).not.toBeVisible();
    await expect(page.getByTestId('preview-cue-list')).toBeVisible();
    await expect(page.getByTestId('preview-cue-item')).toHaveCount(3);
  });

  test('cue click seeks without error', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.previewReady));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByTestId('preview-cue-item').first()).toBeVisible();
    await page.getByTestId('preview-cue-item').first().click();
    await expect(page.getByTestId('preview-cue-list')).toBeVisible();
  });
});
