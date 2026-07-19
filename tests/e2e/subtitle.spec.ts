import { expect, test } from '../fixtures/guardedTest';
import { FIXTURES, fixtureUrl } from '../fixtures/sceneSiftApi';

test.describe('subtitle panel states', () => {
  test('shows not-selected state with select button', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleNotSelected));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('subtitle-panel')).toBeVisible();
    await expect(page.getByTestId('subtitle-not-selected')).toBeVisible();
    await expect(page.getByTestId('subtitle-select-button')).toBeVisible();
    await expect(page.getByTestId('subtitle-parse-button')).not.toBeVisible();
    await expect(page.getByTestId('subtitle-clear-button')).not.toBeVisible();
  });

  test('shows selected state with parse and clear buttons', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleSelected));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('subtitle-selected')).toBeVisible();
    await expect(page.getByTestId('subtitle-parse-button')).toBeVisible();
    await expect(page.getByTestId('subtitle-clear-button')).toBeVisible();
  });

  test('shows cue count and duration in ready state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleReady));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByText('842 cues')).toBeVisible();
    // 2844100 ms → 47:24 (47 minutes 24 seconds)
    await expect(page.getByText('47:24')).toBeVisible();
    await expect(page.getByTestId('subtitle-warning-badge')).not.toBeVisible();
  });

  test('shows warning badge in ready-with-warnings state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleReadyWithWarnings));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('subtitle-warning-badge')).toBeVisible();
    await expect(page.getByText('317 cues')).toBeVisible();
  });

  test('shows human-readable error in parse-failed state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleParseFailed));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('subtitle-error')).toBeVisible();
    // Should show human-readable message, not raw code
    await expect(page.getByTestId('subtitle-error')).not.toContainText('SUBTITLE_PARSE_ERROR');
    await expect(page.getByTestId('subtitle-error')).toContainText('parsing failed');
  });

  test('shows human-readable error in missing state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleMissing));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('subtitle-error')).toBeVisible();
    await expect(page.getByTestId('subtitle-error')).not.toContainText('SUBTITLE_FILE_NOT_FOUND');
    await expect(page.getByTestId('subtitle-error')).toContainText('not found');
  });

  test('shows human-readable error in unsupported state', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleUnsupported));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('subtitle-error')).toBeVisible();
    await expect(page.getByTestId('subtitle-error')).not.toContainText('SUBTITLE_UNSUPPORTED_FORMAT');
    await expect(page.getByTestId('subtitle-error')).toContainText('.srt or .vtt');
  });

  test('select subtitle transitions from not-selected to selected', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleNotSelected));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('subtitle-not-selected')).toBeVisible();
    await page.getByTestId('subtitle-select-button').click();
    // After mock select: should show selected state
    await expect(page.getByTestId('subtitle-selected')).toBeVisible();
  });

  test('parse subtitle transitions from selected to ready', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleSelected));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByTestId('subtitle-selected')).toBeVisible();
    await page.getByTestId('subtitle-parse-button').click();
    // After mock parse: should show cue count
    await expect(page.getByText('42 cues')).toBeVisible();
  });

  test('clear subtitle transitions back to not-selected', async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURES.subtitleReady));
    await page.getByTestId('project-row').first().click();

    await expect(page.getByText('842 cues')).toBeVisible();
    await page.getByTestId('subtitle-clear-button').click();
    await expect(page.getByTestId('subtitle-not-selected')).toBeVisible();
  });
});
