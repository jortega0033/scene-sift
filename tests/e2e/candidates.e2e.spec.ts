import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('Candidates section', () => {
  test.describe('subtitle not ready', () => {
    test('shows placeholder when subtitle not parsed', async ({ page }) => {
      await page.goto(fixtureUrl(FIXTURES.candidatesNotReady));

      const row = page.getByTestId('project-row').first();
      await row.click();

      await expect(page.getByTestId('candidates-section')).toBeVisible();
      await expect(
        page.getByText(/parse the subtitle file first/i),
      ).toBeVisible();
    });

    test('generate candidates button not present', async ({ page }) => {
      await page.goto(fixtureUrl(FIXTURES.candidatesNotReady));

      const row = page.getByTestId('project-row').first();
      await row.click();

      await expect(page.getByTestId('candidates-section')).toBeVisible();
      await expect(
        page.getByTestId('generate-candidates-button'),
      ).not.toBeVisible();
    });
  });

  test.describe('generating state', () => {
    test('generate button visible and active when no prior generation', async ({ page }) => {
      await page.goto(fixtureUrl(FIXTURES.candidatesGenerating));

      const row = page.getByTestId('project-row').first();
      await row.click();

      await expect(page.getByTestId('candidates-section')).toBeVisible();
      await expect(page.getByTestId('generate-candidates-button')).toBeVisible();
    });
  });

  test.describe('candidates ready', () => {
    test('renders candidates list', async ({ page }) => {
      await page.goto(fixtureUrl(FIXTURES.candidatesReady));

      const row = page.getByTestId('project-row').first();
      await row.click();

      await expect(page.getByTestId('candidates-section')).toBeVisible();
      await expect(page.getByTestId('candidates-list')).toBeVisible();
      await expect(page.getByTestId('candidate-item').first()).toBeVisible();
    });

    test('candidate items show approve and reject buttons for suggested', async ({ page }) => {
      await page.goto(fixtureUrl(FIXTURES.candidatesReady));

      const row = page.getByTestId('project-row').first();
      await row.click();

      await expect(page.getByTestId('candidates-list')).toBeVisible();
      await expect(page.getByTestId('approve-candidate-button').first()).toBeVisible();
      await expect(page.getByTestId('reject-candidate-button').first()).toBeVisible();
    });

    test('generation status shows Ready', async ({ page }) => {
      await page.goto(fixtureUrl(FIXTURES.candidatesReady));

      const row = page.getByTestId('project-row').first();
      await row.click();

      await expect(page.getByTestId('generation-status')).toBeVisible();
      await expect(page.getByTestId('generation-status')).toContainText('Ready');
    });

    test('generate candidates button present after prior generation', async ({ page }) => {
      await page.goto(fixtureUrl(FIXTURES.candidatesReady));

      const row = page.getByTestId('project-row').first();
      await row.click();

      await expect(page.getByTestId('generate-candidates-button')).toBeVisible();
      await expect(page.getByTestId('generate-candidates-button')).not.toBeDisabled();
    });
  });
});
