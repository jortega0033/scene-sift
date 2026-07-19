import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('sync panel states', () => {
  test('shows sync panel when project selected', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncNotAvailable));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('sync-panel')).toBeVisible();
  });

  test('not_available — no check button shown', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncNotAvailable));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('sync-panel')).toBeVisible();
    // Button should be absent or disabled — not available means no prerequisites
    const btn = page.getByTestId('sync-check-button');
    const btnCount = await btn.count();
    if (btnCount > 0) {
      await expect(btn).toBeDisabled();
    }
  });

  test('ready_to_check — check button enabled', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncReadyToCheck));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('sync-panel')).toBeVisible();
    await expect(page.getByTestId('sync-check-button')).toBeVisible();
    await expect(page.getByTestId('sync-check-button')).toBeEnabled();
  });

  test('timing_ok — shows ok status', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncTimingOk));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('sync-panel')).toBeVisible();
    await expect(page.getByTestId('sync-status')).toContainText('Timing OK');
    await expect(page.getByTestId('sync-warnings-list')).not.toBeVisible();
  });

  test('needs_review — shows warnings list', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncNeedsReview));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('sync-panel')).toBeVisible();
    await expect(page.getByTestId('sync-status')).toContainText('Needs review');
    await expect(page.getByTestId('sync-warnings-list')).toBeVisible();
  });

  test('check_failed — shows failure state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncCheckFailed));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('sync-panel')).toBeVisible();
    await expect(page.getByTestId('sync-status')).toContainText('Check failed');
  });

  test('stale — shows needs-recheck state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncStale));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('sync-panel')).toBeVisible();
    await expect(page.getByTestId('sync-status')).toContainText('Needs recheck');
  });

  test('check button triggers sync and updates status', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.syncReadyToCheck));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('sync-check-button')).toBeEnabled();
    await page.getByTestId('sync-check-button').click();

    // Mock returns timing_ok after successful check
    await expect(page.getByTestId('sync-status')).toContainText('Timing OK');
  });
});
