import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';
import { waitForStableUi } from '../helpers/screenshot';

test.describe('@visual dialogs', () => {
  test('create project dialog/form', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.noProjects));
    await page.getByRole('button', { name: 'Create project' }).click();
    await waitForStableUi(page);
    await expect(page).toHaveScreenshot('create-project-dialog.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
  });
});
