import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('media inspection', () => {
  test('displays inspection error pill and error code for failed project', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.inspectionFailedProject));

    await page.getByRole('button', { name: /Corrupted Source File/ }).click();

    await expect(page.getByTestId('inspection-error')).toBeVisible();
    await expect(page.getByTestId('inspection-error')).toContainText('Media analysis failed');
  });

  test('shows warning status pill for inspection_failed project in list', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.inspectionFailedProject));

    const pill = page.locator('[data-testid="project-row"]').first().getByText('inspection_failed');
    await expect(pill).toBeVisible();
  });

  test('displays media metadata section for ready project', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.multipleProjects));

    await page.getByRole('button', { name: /Episode 04/ }).click();

    await expect(page.getByText('1920×1080')).toBeVisible();
    await expect(page.getByText('h264')).toBeVisible();
  });

  test('inspect media button triggers inspection and updates status to ready', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.inspectionFailedProject));

    await page.getByRole('button', { name: /Episode 04/ }).click();

    await page.getByTestId('inspect-button').click();

    await expect(page.getByText('1920×1080')).toBeVisible({ timeout: 5000 });
  });
});
