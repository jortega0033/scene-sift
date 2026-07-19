import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test('navigates between projects, queue, and settings', async ({ page }) => {
  await page.goto(fixtureUrl(FIXTURES.multipleProjects));

  await page.getByRole('button', { name: 'Queue' }).click();
  await expect(page.getByTestId('queue-page')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('settings-page')).toBeVisible();

  await page.getByRole('button', { name: 'Projects' }).click();
  await expect(page.getByTestId('projects-page')).toBeVisible();
});
