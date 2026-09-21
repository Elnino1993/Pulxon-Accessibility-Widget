import { expect, test } from '@playwright/test';
import { ORIGIN, loadWidget, pageHtml, serve } from './fixture';

// By its exact name: the fixture page has an "Accessibility options" button of its own.
const open = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Open accessibility menu' }).click();

test('a language picked in the panel is fetched from next to the script and shown', async ({ page }) => {
  await loadWidget(page);
  await open(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.locator('[data-pulxon-lang-picker]').selectOption('de');
  await expect(page.locator('#pulxon-title')).toHaveText('Barrierefreiheit');
  expect(requests.filter((url) => url.endsWith('/locales/de.json'))).toHaveLength(1);
  // Only the language asked for: the other 51 stay on the server.
  expect(requests.filter((url) => url.includes('/locales/'))).toHaveLength(1);
});

test("the panel follows the page's own language without being asked", async ({ page }) => {
  await serve(page, pageHtml('<script src="/pulxon.min.js"></script>').replace('<html lang="en">', '<html lang="fr">'));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
  await expect(page.getByRole('button', { name: "Ouvrir le menu d'accessibilité" })).toBeVisible();
});

test('Arabic lays the panel out right to left', async ({ page }) => {
  await loadWidget(page);
  await open(page);
  await page.locator('[data-pulxon-lang-picker]').selectOption('ar');
  await expect(page.locator('#pulxon-panel')).toHaveCSS('direction', 'rtl');
});

test('the font size stepper scales the page text and says by how much', async ({ page }) => {
  await loadWidget(page);
  await open(page);
  const heading = page.locator('h1');
  const before = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.getByRole('button', { name: 'Increase font size' }).click();
  await expect(page.locator('[data-pulxon-font-size-value]')).toHaveText('120%');
  await expect.poll(() => heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Decrease font size' }).click();
  await expect(page.locator('[data-pulxon-font-size-value]')).toHaveText('100%');
  // At 100% the decrease button says it can go no lower, and keeps focus instead of losing it.
  await expect(page.getByRole('button', { name: 'Decrease font size' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Decrease font size' })).toBeFocused();
});

test('color modes are one tile each, and one contrast mode replaces another', async ({ page }) => {
  await loadWidget(page);
  await open(page);
  const htmlFilter = () => page.evaluate(() => getComputedStyle(document.documentElement).filter);
  await page.getByRole('button', { name: 'Monochrome' }).click();
  await expect.poll(htmlFilter).toContain('grayscale(1)');
  await page.getByRole('button', { name: 'High contrast' }).click();
  await expect.poll(htmlFilter).toContain('contrast(1.3)');
  await page.getByRole('button', { name: 'Dark contrast' }).click();
  await expect(page.getByRole('button', { name: 'High contrast' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Dark contrast' })).toHaveAttribute('aria-pressed', 'true');
  // Monochrome is saturation, not contrast, so it stays on.
  await expect(page.getByRole('button', { name: 'Monochrome' })).toHaveAttribute('aria-pressed', 'true');
});

test('the info button explains a section in place', async ({ page }) => {
  await loadWidget(page);
  await open(page);
  const info = page.getByRole('button', { name: 'About Color adjustments' });
  await expect(info).toHaveAttribute('aria-expanded', 'false');
  await info.click();
  await expect(info).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('One contrast mode and one saturation mode can be on at a time.', { exact: false })).toBeVisible();
});
