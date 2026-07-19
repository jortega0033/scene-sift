import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual queue', () => {
  test('queue populated with statuses', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.queueMixed));
    await page.getByRole('button', { name: 'Queue' }).click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('queue-populated.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
