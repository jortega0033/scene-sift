import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('transcript page', () => {
  test('shows select-project message when no project selected', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptNotAvailable));
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('transcript-not-available')).toBeVisible();
    await expect(page.getByText('Select a project to generate a transcript')).toBeVisible();
  });

  test('shows prerequisite list when project lacks subtitle', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptNotAvailable));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('transcript-not-available')).toBeVisible();
    await expect(page.getByText('Subtitle parsed')).toBeVisible();
  });

  test('shows transcript entries when subtitle ready', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptReady));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('transcript-page')).toBeVisible();
    await expect(page.getByTestId('transcript-entry-list')).toBeVisible();
    await expect(page.getByTestId('transcript-entry').first()).toBeVisible();
  });

  test('shows warning banner when subtitle has warnings', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptReadyWithWarnings));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('subtitle-warning-banner')).toBeVisible();
    await expect(page.getByTestId('transcript-entry-list')).toBeVisible();
  });

  test('gap threshold slider is visible and interactive', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptReady));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('gap-threshold-slider')).toBeVisible();
    await expect(page.getByLabel('Merge gap')).toBeVisible();
  });

  test('export buttons visible when entries present', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptReady));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('export-txt-button')).toBeVisible();
    await expect(page.getByTestId('export-json-button')).toBeVisible();
  });

  test('back button navigates to projects', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.transcriptReady));
    await page.getByTestId('project-row').first().click();
    await page.getByRole('button', { name: 'Transcript' }).click();
    await expect(page.getByTestId('transcript-page')).toBeVisible();
    await page.getByText('◀ Back to Projects').click();
    await expect(page.getByTestId('projects-page')).toBeVisible();
  });
});
