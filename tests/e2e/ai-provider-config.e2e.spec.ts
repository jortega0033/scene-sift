import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('AI provider configuration', () => {
  test('AI Provider section renders with privacy notice in default state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.settingsDefaults));
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.getByTestId('ai-provider-section')).toBeVisible();
    await expect(page.getByTestId('ai-privacy-notice')).toBeVisible();
    await expect(page.getByTestId('ai-save-button')).toBeDisabled();
  });

  test('consent button is visible and enabled before consent', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.settingsDefaults));
    await page.getByRole('button', { name: 'Settings' }).click();

    const consentBtn = page.getByTestId('ai-consent-button');
    await expect(consentBtn).toBeVisible();
    await expect(consentBtn).not.toBeDisabled();
  });

  test('form inputs are present in unconfigured state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.settingsDefaults));
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.getByTestId('ai-provider-form')).toBeVisible();
    await expect(page.getByTestId('ai-provider-input')).toBeVisible();
    await expect(page.getByTestId('ai-endpoint-input')).toBeVisible();
    await expect(page.getByTestId('ai-model-input')).toBeVisible();
    await expect(page.getByTestId('ai-apikey-input')).toBeVisible();
  });

  test('API key input uses password type to prevent value display', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.settingsDefaults));
    await page.getByRole('button', { name: 'Settings' }).click();

    const keyInput = page.getByTestId('ai-apikey-input');
    await expect(keyInput).toHaveAttribute('type', 'password');
    await expect(keyInput).toHaveAttribute('autocomplete', 'new-password');
  });

  test('section has correct ARIA region landmark', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.settingsDefaults));
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(
      page.getByRole('region', { name: 'AI Provider configuration' }),
    ).toBeVisible();
  });
});
