import { _electron as electron, expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';

test('electron app launches with preload API and shell controls', async () => {
  test.skip(!existsSync('dist-electron/main/index.js') || !existsSync('dist/renderer/index.html'));

  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SCENESIFT_ELECTRON_SMOKE: '1',
    },
  });

  const window = await app.firstWindow();
  await expect(window).toHaveTitle(/SceneSift/i);
  await expect(window.getByTestId('app-shell')).toBeVisible();
  await expect(window.getByRole('button', { name: 'Projects' })).toBeVisible();

  const apiAvailable = await window.evaluate(() => Boolean(window.sceneSift));
  expect(apiAvailable).toBe(true);

  const version = await window.evaluate(() => window.sceneSift.app.getVersion());
  expect(version).toMatch(/\d+\.\d+\.\d+/);

  await window.getByRole('button', { name: 'Queue' }).click();
  await expect(window.getByTestId('queue-page')).toBeVisible();

  await window.evaluate(() => {
    window.location.assign('https://example.com/');
  });
  await window.waitForTimeout(300);
  const currentUrl = await window.evaluate(() => window.location.href);
  expect(currentUrl.startsWith('https://example.com')).toBe(false);

  const popup = await window.evaluate(() => {
    const opened = window.open('https://example.com');
    return opened === null;
  });
  expect(popup).toBe(true);

  await app.close();
});
