import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test('supports keyboard navigation and dialog escape', async ({ page }) => {
  await page.goto(fixtureUrl(FIXTURES.oneProject));

  await page.getByRole('button', { name: 'Queue' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('queue-page')).toBeVisible();

  await page.getByRole('button', { name: 'Projects' }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByTestId('project-editor-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('project-editor-dialog')).toHaveCount(0);
});
