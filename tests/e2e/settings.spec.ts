import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('settings page', () => {
  test('shows ffmpeg unavailable and database error states', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.ffmpegUnavailable));
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByTestId('system-status').getByText('Missing').first()).toBeVisible();

    await page.goto(fixtureUrl(FIXTURES.databaseError));
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('/fixtures/scenesift.sqlite')).toBeVisible();
  });

  test('updates settings and surfaces save failure', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.settingsDefaults));
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Default output directory').fill('/fixtures/exports/new');
    await page.getByRole('button', { name: 'Save settings' }).click();

    await page.goto(fixtureUrl(FIXTURES.settingsSaveFailure));
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Default output directory').fill('/fixtures/exports/failure');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText(/Unable to save settings in this fixture/)).toBeVisible();
  });
});
