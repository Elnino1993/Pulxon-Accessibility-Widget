import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ORIGIN, collectConsoleErrors, loadWidget, pageHtml, serve } from './fixture';

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

test('a configured mobile position wins over the reset at small viewports', async ({ page }) => {
  const OFFSET = 20; // DEFAULT_OPTIONS.offsetX / offsetY
  await loadWidget(page, { 'data-position': 'top-right', 'data-mobile-position': 'bottom-center' });
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBox = await launcher.boundingBox();
  expect(mobileBox).not.toBeNull();
  const centerX = mobileBox!.x + mobileBox!.width / 2;
  expect(centerX).toBeGreaterThanOrEqual(390 / 2 - 2);
  expect(centerX).toBeLessThanOrEqual(390 / 2 + 2);
  const bottomGap = 844 - (mobileBox!.y + mobileBox!.height);
  expect(bottomGap).toBeGreaterThanOrEqual(0);
  expect(bottomGap).toBeLessThanOrEqual(OFFSET + 2);

  await page.setViewportSize({ width: 1280, height: 800 });
  const desktopBox = await launcher.boundingBox();
  expect(desktopBox).not.toBeNull();
  expect(desktopBox!.y).toBeLessThanOrEqual(OFFSET + 2);
  const rightGap = 1280 - (desktopBox!.x + desktopBox!.width);
  expect(rightGap).toBeLessThanOrEqual(OFFSET + 2);
});

test('a configured mobile top-left position also wins over the reset', async ({ page }) => {
  const OFFSET = 20;
  await loadWidget(page, { 'data-position': 'top-right', 'data-mobile-position': 'top-left' });
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });

  await page.setViewportSize({ width: 390, height: 844 });
  const box = await launcher.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(OFFSET + 2);
  expect(box!.y).toBeLessThanOrEqual(OFFSET + 2);
});

test("a visitor's chosen corner overrides the owner's mobile position at narrow viewports", async ({ page }) => {
  const OFFSET = 20; // DEFAULT_OPTIONS.offsetX / offsetY
  await loadWidget(page, { 'data-position': 'top-right', 'data-mobile-position': 'bottom-center' });
  await page.setViewportSize({ width: 390, height: 844 });
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });

  // No visitor choice yet: the owner's `data-mobile-position` still wins (unchanged default).
  const beforeBox = await launcher.boundingBox();
  expect(beforeBox).not.toBeNull();
  const beforeCenterX = beforeBox!.x + beforeBox!.width / 2;
  expect(beforeCenterX).toBeGreaterThanOrEqual(390 / 2 - 2);
  expect(beforeCenterX).toBeLessThanOrEqual(390 / 2 + 2);

  // The visitor picks their own spot from the panel — an explicit act about their own need.
  await launcher.click();
  await page.getByRole('button', { name: 'Bottom left' }).click();
  await page.keyboard.press('Escape');

  // Their choice now wins over the owner's mobile-position default, still at a narrow viewport.
  const afterBox = await launcher.boundingBox();
  expect(afterBox).not.toBeNull();
  expect(afterBox!.x).toBeLessThanOrEqual(OFFSET + 2);
  expect(afterBox!.y + afterBox!.height).toBeGreaterThanOrEqual(844 - OFFSET - 2);
});

test('the in-panel language picker switches the panel heading', async ({ page }) => {
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  await page.locator('#pulxon-lang-select').selectOption('es');
  await expect(page.locator('#pulxon-title')).toHaveText('Accesibilidad');
});

test('the large size button grows the rendered launcher', async ({ page }) => {
  await loadWidget(page);
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  const before = await launcher.boundingBox();

  await launcher.click();
  await page.getByRole('button', { name: 'Large', exact: true }).click();

  const after = await launcher.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(after!.width).toBeGreaterThan(before!.width);
});

test('picking a spot in the position picker moves the launcher along the bottom', async ({ page }) => {
  await loadWidget(page); // default position is bottom-left
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  const viewport = page.viewportSize()!;

  const start = await launcher.boundingBox();
  expect(start).not.toBeNull();
  expect(start!.x, 'the default launcher sits on the left').toBeLessThan(100);

  await launcher.click();
  await page.getByRole('button', { name: 'Bottom right' }).click();
  await page.keyboard.press('Escape');
  const right = (await launcher.boundingBox())!;
  expect(right.x + right.width).toBeGreaterThan(viewport.width - 100);
  expect(right.y).toBeGreaterThan(viewport.height - 100);

  await launcher.click();
  await page.getByRole('button', { name: 'Bottom center' }).click();
  await page.keyboard.press('Escape');
  const center = (await launcher.boundingBox())!;
  expect(Math.abs(center.x + center.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
  expect(center.y).toBeGreaterThan(viewport.height - 100);
});

test('shows the accessibility statement link when the embed provides a data-statement-url', async ({ page }) => {
  await loadWidget(page, { 'data-statement-url': 'https://example.com/accessibility' });
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const link = page.locator('[data-pulxon-statement]');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://example.com/accessibility');
});

test('shows no statement link when the embed has no data-statement-url', async ({ page }) => {
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  await expect(page.locator('[data-pulxon-statement]')).toHaveCount(0);
});

test('the voice navigation tile is absent when the browser offers no speech recognition', async ({ page }) => {
  await page.addInitScript(() => {
    const win = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    delete win.SpeechRecognition;
    delete win.webkitSpeechRecognition;
  });
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  await expect(page.getByRole('button', { name: 'Voice navigation' })).toHaveCount(0);
  // The rest of voice navigation (listening, commands, fatal-error handling) cannot be driven here:
  // the e2e browser will not grant a microphone. It is covered by src/features/voice-navigation.test.ts.
});

test('panel text size does not depend on the host root font size', async ({ page }) => {
  await serve(page, pageHtml('<script src="/pulxon.min.js"></script>', '<style>html{font-size:62.5%}</style>'));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  // 1.0625em of the panel's own 16px base: 17px whatever the host's root font size is.
  await expect(page.locator('#pulxon-title')).toHaveCSS('font-size', '17px');
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
  // A transformed ancestor makes `position: fixed` resolve against that ancestor instead of the
  // viewport, which is the bug this guards. The launcher's default corner is bottom left.
  const viewport = page.viewportSize();
  const box = await page.getByRole('button', { name: 'Open accessibility menu' }).boundingBox();
  expect(viewport).not.toBeNull();
  expect(box?.x ?? 0).toBeLessThan(100);
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
  const errors = collectConsoleErrors(page);
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
  const errors = collectConsoleErrors(page);
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
