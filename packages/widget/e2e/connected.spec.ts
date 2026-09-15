import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ORIGIN, collectConsoleErrors, pageHtml, serve } from './fixture';

const API = 'https://api.pulxon.test';
const SITE_KEY = 'pk_test_connected123';
const CONTRACT = readFileSync(new URL('../../../contracts/widget-config.v1.json', import.meta.url), 'utf8');

async function routeConfig(page: Page, handler: Parameters<Page['route']>[1]): Promise<void> {
  await page.route(`${API}/v1/sites/${SITE_KEY}/config`, handler);
}

async function bootConnected(page: Page, extraAttributes = ''): Promise<void> {
  await serve(page, pageHtml(`<script src="/pulxon.min.js" data-site-key="${SITE_KEY}" data-api="${API}"${extraAttributes}></script>`));
  await page.goto(`${ORIGIN}/`);
}

// The fixture contract sets lang "es", so the launcher's accessible name is localized too.
const launcher = (page: Page, name = 'Open accessibility menu') => page.getByRole('button', { name });

test('loads settings from the dashboard config', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  let requestHeaders: Record<string, string> = {};
  await routeConfig(page, async (route) => {
    requestHeaders = route.request().headers();
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': ORIGIN }, body: CONTRACT });
  });
  await bootConnected(page);

  const esLauncher = launcher(page, 'Abrir menú de accesibilidad');
  await expect(esLauncher).toBeVisible();
  await expect(esLauncher).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  expect(await esLauncher.evaluate((el) => el.className)).toContain('launcher--bottom-left');
  expect(requestHeaders.cookie).toBeUndefined();

  await esLauncher.click();
  const dialog = page.getByRole('dialog', { name: 'Accesibilidad' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('link', { name: /Pulxon/ })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  expect(errors).toEqual([]);
});

test('data attributes override the dashboard config', async ({ page }) => {
  await routeConfig(page, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': ORIGIN }, body: CONTRACT }),
  );
  await bootConnected(page, ' data-color="#7c2d12" data-lang="en"');
  await expect(launcher(page)).toHaveCSS('background-color', 'rgb(124, 45, 18)');
});

test('starts with local options when the config request fails', async ({ page }) => {
  await routeConfig(page, (route) => route.fulfill({ status: 500, body: 'boom' }));
  await bootConnected(page);
  await expect(launcher(page)).toBeVisible();
  await expect(launcher(page)).toHaveCSS('background-color', 'rgb(31, 75, 255)');
});

test('starts with local options when the config API does not answer in time', async ({ page }) => {
  await routeConfig(page, () => new Promise(() => undefined));
  const started = Date.now();
  await bootConnected(page);
  await expect(launcher(page)).toBeVisible({ timeout: 6000 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(2500);
});

test('ignores a config with an unknown version', async ({ page }) => {
  await routeConfig(page, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': ORIGIN }, body: JSON.stringify({ version: 2, widget: { color: '#000000' } }) }),
  );
  await bootConnected(page);
  await expect(launcher(page)).toHaveCSS('background-color', 'rgb(31, 75, 255)');
});

test('works under a strict CSP that allows the config API', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await routeConfig(page, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': ORIGIN }, body: CONTRACT }),
  );
  await serve(
    page,
    pageHtml(`<script src="/pulxon.min.js" data-site-key="${SITE_KEY}" data-api="${API}"></script>`),
    { 'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self'; connect-src ${API}` },
  );
  await page.goto(`${ORIGIN}/`);
  await expect(launcher(page, 'Abrir menú de accesibilidad')).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  expect(errors).toEqual([]);
});
