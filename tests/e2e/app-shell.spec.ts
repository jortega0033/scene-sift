import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('app shell', () => {
  test('renders shell and primary navigation', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.multipleProjects));
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SceneSift' })).toBeVisible();
    await expect(page.getByTestId('primary-navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Queue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  });
});
