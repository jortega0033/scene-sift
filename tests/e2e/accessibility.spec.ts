import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test('navigation and forms expose accessible names and roles', async ({ page }) => {
  await page.goto(fixtureUrl(FIXTURES.multipleProjects));
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create project' })).toBeVisible();

  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByLabel('Project name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select video file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save project' })).toBeVisible();
});
