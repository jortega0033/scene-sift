import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('projects flow', () => {
  test('shows empty state and validates required fields', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.noProjects));

    await expect(page.getByText('No projects yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByTestId('project-editor-dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Save project' }).click();
    await expect(page.getByText('Project name is required.')).toBeVisible();
  });

  test('creates and deletes a project using keyboard-first interactions', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.noProjects));
    await page.getByRole('button', { name: 'Create project' }).click();

    await page.getByLabel('Project name').fill('Keyboard Project');
    await page.getByRole('button', { name: 'Select video file' }).click();
    await page.getByRole('button', { name: 'Save project' }).press('Enter');

    await expect(page.getByText('Keyboard Project')).toBeVisible();
    await page.getByRole('button', { name: /Keyboard Project/ }).click();
    await page.getByRole('button', { name: 'Delete project' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete project confirmation' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page.getByText('Keyboard Project')).toHaveCount(0);
  });

  test('handles long and unicode file names without overflow regressions', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.multipleProjects));
    await page.getByRole('button', { name: /Unicode Subtitle Check/ }).click();
    await expect(page.getByText('/fixtures/字幕_日本語.srt')).toBeVisible();
  });
});
