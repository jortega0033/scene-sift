import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('queue page', () => {
  test('renders empty queue state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.emptyQueue));
    await page.getByRole('button', { name: 'Queue' }).click();
    await expect(page.getByText('No jobs in queue.')).toBeVisible();
  });

  test('renders mixed queue statuses and long error text', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.queueMixed));
    await page.getByRole('button', { name: 'Queue' }).click();
    const queuePage = page.getByTestId('queue-page');
    await expect(queuePage.getByText(/^queued$/)).toBeVisible();
    await expect(queuePage.getByText(/^running$/)).toBeVisible();
    await expect(queuePage.getByText(/^completed$/)).toBeVisible();
    await expect(queuePage.getByText(/^failed$/)).toBeVisible();
    await expect(queuePage.getByText(/^cancelled$/)).toBeVisible();
    await expect(page.getByText(/Render failed while preparing filter graph/)).toBeVisible();
  });
});
