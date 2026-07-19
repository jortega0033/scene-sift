import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual settings', () => {
  test('settings default state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.settingsDefaults));
    await page.getByRole('button', { name: 'Settings' }).click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('settings-defaults.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });

  test('ffmpeg unavailable state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.ffmpegUnavailable));
    await page.getByRole('button', { name: 'Settings' }).click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('settings-ffmpeg-unavailable.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
