import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BUNDLE = readFileSync(fileURLToPath(new URL('../dist/pulxon.min.js', import.meta.url)), 'utf8');
const ORIGIN = 'https://fixture.pulxon.test';

function pageHtml(scripts: string, head = ''): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture</title>' +
    head +
    '</head><body>' +
    '<main><h1>Fixture page</h1><p>Read the <a href="#docs">documentation</a>.</p>' +
    '<button id="my-trigger" type="button">Accessibility options</button></main>' +
    scripts +
    '</body></html>'
  );
}

async function serve(page: Page, html: string, headers: Record<string, string> = {}): Promise<void> {
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', headers, body: html }),
  );
  await page.route(`${ORIGIN}/pulxon.min.js`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: BUNDLE }),
  );
}

async function loadWidget(page: Page, attributes: Record<string, string> = {}): Promise<void> {
  const attrs = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
  await serve(page, pageHtml(`<script src="/pulxon.min.js"${attrs}></script>`));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
}

test('opens from the keyboard, traps focus, closes with Escape and restores focus', async ({ page }) => {
  await loadWidget(page);
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  await launcher.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Accessibility' });
  await expect(dialog).toBeVisible();
  const close = page.getByRole('button', { name: 'Close accessibility menu' });
  await expect(close).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('link', { name: /Powered by Pulxon/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeFocused();
});

test('applies a feature and persists it across reloads', async ({ page }) => {
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const tile = page.getByRole('button', { name: 'Highlight links' });
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'documentation' })).toHaveCSS('outline-style', 'solid');

  await page.reload();
  await page.waitForFunction(() => 'Pulxon' in window);
  await expect(page.getByRole('link', { name: 'documentation' })).toHaveCSS('outline-style', 'solid');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('respects data attributes and a custom trigger', async ({ page }) => {
  await loadWidget(page, { 'data-position': 'top-left', 'data-lang': 'es', 'data-trigger': '#my-trigger' });
  const launcher = page.getByRole('button', { name: 'Abrir menú de accesibilidad' });
  const box = await launcher.boundingBox();
  expect(box?.x ?? Number.POSITIVE_INFINITY).toBeLessThan(100);
  expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(100);

  const trigger = page.getByRole('button', { name: 'Accessibility options' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Accesibilidad' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('panel text size does not depend on the host root font size', async ({ page }) => {
  await serve(page, pageHtml('<script src="/pulxon.min.js"></script>', '<style>html{font-size:62.5%}</style>'));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  await expect(page.locator('#pulxon-title')).toHaveCSS('font-size', '20px');
});

test('host page CSS can hide the widget root', async ({ page }) => {
  await serve(page, pageHtml('<script src="/pulxon.min.js"></script>', '<style>#pulxon-root{display:none !important}</style>'));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
  await expect(page.locator('#pulxon-root')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open accessibility menu' })).toBeHidden();
});

test('host page transforms do not break fixed positioning of the launcher', async ({ page }) => {
  await serve(
    page,
    pageHtml('<script src="/pulxon.min.js"></script>', '<style>body > div{display:block;transform:translateX(10px)}</style>'),
  );
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
  const viewport = page.viewportSize();
  const box = await page.getByRole('button', { name: 'Open accessibility menu' }).boundingBox();
  expect(viewport).not.toBeNull();
  expect(box?.x ?? 0).toBeGreaterThan((viewport?.width ?? 0) - 100);
  expect(box?.y ?? 0).toBeGreaterThan((viewport?.height ?? 0) - 100);
});

test('the widget is hidden when printing', async ({ page }) => {
  await loadWidget(page);
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  await expect(launcher).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(launcher).toBeHidden();
});

test('the open panel has no WCAG A/AA axe violations', async ({ page }) => {
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('#pulxon-root')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('works under a strict Content-Security-Policy', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await serve(page, pageHtml('<script src="/pulxon.min.js"></script>'), {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'",
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);

  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  await expect(launcher).toHaveCSS('position', 'fixed');
  await launcher.click();
  await page.getByRole('button', { name: 'Highlight links' }).click();
  await expect(page.getByRole('link', { name: 'documentation' })).toHaveCSS('outline-style', 'solid');
  expect(errors.filter((text) => text.includes('Content Security Policy'))).toEqual([]);
});

test('falls back to nonce style tags when constructable stylesheets are unavailable', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const nonce = 'e2eNonce123';
  const scripts =
    `<script nonce="${nonce}">delete Document.prototype.adoptedStyleSheets;delete ShadowRoot.prototype.adoptedStyleSheets;</script>` +
    `<script src="/pulxon.min.js" data-nonce="${nonce}"></script>`;
  await serve(page, pageHtml(scripts), {
    'Content-Security-Policy': `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'`,
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
  expect(await page.evaluate(() => 'adoptedStyleSheets' in document)).toBe(false);

  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  await expect(launcher).toHaveCSS('position', 'fixed');
  await launcher.click();
  await page.getByRole('button', { name: 'Highlight links' }).click();
  await expect(page.getByRole('link', { name: 'documentation' })).toHaveCSS('outline-style', 'solid');
  await expect(page.locator('style[data-pulxon-style="highlight-links"]')).toHaveCount(1);
  expect(errors.filter((text) => text.includes('Content Security Policy'))).toEqual([]);
});

test('ignores a second copy of the script', async ({ page }) => {
  await serve(page, pageHtml('<script src="/pulxon.min.js"></script><script src="/pulxon.min.js"></script>'));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
  await expect(page.locator('#pulxon-root')).toHaveCount(1);
});

test('destroy releases the global so the widget can boot again', async ({ page }) => {
  await loadWidget(page);
  await page.evaluate(() => window.Pulxon?.destroy());
  expect(await page.evaluate(() => 'Pulxon' in window)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-pulxon-loaded'))).toBe(false);
  await expect(page.locator('#pulxon-root')).toHaveCount(0);

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = '/pulxon.min.js';
    document.body.appendChild(script);
  });
  await page.waitForFunction(() => 'Pulxon' in window);
  await expect(page.locator('#pulxon-root')).toHaveCount(1);
});

test('destroying a replaced instance keeps the current global', async ({ page }) => {
  await loadWidget(page);
  const kept = await page.evaluate(() => {
    const original = window.Pulxon;
    const replacement = { marker: true } as unknown as NonNullable<typeof window.Pulxon>;
    window.Pulxon = replacement;
    original?.destroy();
    return window.Pulxon === replacement;
  });
  expect(kept).toBe(true);
});
