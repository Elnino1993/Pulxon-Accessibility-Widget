import { expect, test, type Page } from '@playwright/test';
import { ORIGIN, loadWidget, pageHtml, serve } from './fixture';

/** A page long enough to scroll, so a wheel that escapes the panel would visibly move it. */
const LONG_BODY = `<main><h1>Long page</h1>${'<p>Paragraph of filler text for scrolling.</p>'.repeat(200)}</main>`;

async function loadLongPage(page: Page): Promise<void> {
  await serve(page, pageHtml('<script src="/pulxon.min.js"></script>', '', LONG_BODY));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
}

/** Resolves once the launcher has finished falling, so its box is where it came to rest. */
async function settled(page: Page): Promise<void> {
  await expect
    .poll(() => page.getByRole('button', { name: 'Open accessibility menu' }).evaluate((el) => el.getAnimations().length))
    .toBe(0);
}

/** Presses at the centre of `from`, drags in steps to (x, y) and releases. */
async function dragTo(page: Page, from: { x: number; y: number; width: number; height: number }, x: number, y: number): Promise<void> {
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

test('the launcher can be lifted anywhere, falls back to the bottom when let go, and stays there after a reload', async ({ page }) => {
  await loadWidget(page);
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  const viewport = page.viewportSize()!;
  const start = (await launcher.boundingBox())!;

  // While held it goes wherever the pointer takes it, high up included.
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(600, 250, { steps: 12 });
  const held = (await launcher.boundingBox())!;
  expect(Math.round(held.y + held.height / 2)).toBe(250);
  await page.mouse.up();

  // Let go, it falls straight down to the bottom edge and keeps its place across.
  await settled(page);
  const dropped = (await launcher.boundingBox())!;
  expect(Math.round(dropped.x + dropped.width / 2)).toBe(600);
  expect(Math.round(dropped.y + dropped.height)).toBe(viewport.height - 8);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();
  await page.waitForFunction(() => 'Pulxon' in window);
  const reloaded = (await launcher.boundingBox())!;
  expect(Math.abs(reloaded.x - dropped.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(reloaded.y - dropped.y)).toBeLessThanOrEqual(1);

  // A plain click still opens it, and the panel opens beside it rather than back in the old corner.
  await launcher.click();
  const panel = (await page.getByRole('dialog').boundingBox())!;
  expect(Math.abs(panel.x - reloaded.x) < 400 || Math.abs(panel.x + panel.width - (reloaded.x + reloaded.width)) < 400).toBe(true);
});

test('the launcher cannot be dragged off screen', async ({ page }) => {
  await loadWidget(page);
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  const viewport = page.viewportSize()!;
  await dragTo(page, (await launcher.boundingBox())!, viewport.width + 300, -300);
  await settled(page);
  const box = (await launcher.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});

test('the panel can be dragged by its title bar and stays put when reopened', async ({ page }) => {
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Accessibility' });
  const title = (await page.locator('#pulxon-title').boundingBox())!;
  const before = (await dialog.boundingBox())!;

  await dragTo(page, title, title.x + title.width / 2 + 400, title.y + title.height / 2 + 30);
  const after = (await dialog.boundingBox())!;
  expect(Math.round(after.x - before.x)).toBe(400);
  expect(Math.round(after.y - before.y)).toBe(30);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const reopened = (await dialog.boundingBox())!;
  expect(Math.abs(reopened.x - after.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(reopened.y - after.y)).toBeLessThanOrEqual(1);
});

test('picking a spot puts a dragged launcher back there', async ({ page }) => {
  await loadWidget(page);
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  await dragTo(page, (await launcher.boundingBox())!, 600, 300);
  await settled(page);
  await launcher.click();
  await page.getByRole('button', { name: 'Bottom right' }).click();
  const box = (await launcher.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y).toBeGreaterThan(viewport.height - 100);
  expect(box.x + box.width).toBeGreaterThan(viewport.width - 100);
});

test('the panel content scrolls with the wheel and the page behind it does not', async ({ page }) => {
  await loadLongPage(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const body = page.locator('.panel__body');
  const box = (await body.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await page.mouse.wheel(0, 400);
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  // Past the end: the rest of the scroll must not carry on into the page underneath.
  await page.mouse.wheel(0, 20000);
  await expect.poll(() => body.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1)).toBe(true);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // The title bar, with the close button, is outside the scrolled region and still on screen.
  await expect(page.getByRole('button', { name: 'Close accessibility menu' })).toBeInViewport();
});

test('the tiles sit three to a row, as in Sienna', async ({ page }) => {
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const tops = await page.locator('[data-pulxon-section="content"] .tile').evaluateAll((tiles) =>
    tiles.map((tile) => Math.round(tile.getBoundingClientRect().top)),
  );
  const firstRow = tops.filter((top) => top === tops[0]).length;
  expect(firstRow).toBe(3);
});

test('the panel opens docked to the screen edge on the launcher side, full height', async ({ page }) => {
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const box = (await page.getByRole('dialog').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(Math.round(box.height)).toBe(viewport.height);
  expect(Math.round(box.width)).toBe(340);
});

test('the panel fits a 320px-wide phone without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const dialog = (await page.getByRole('dialog').boundingBox())!;
  expect(dialog.x).toBeGreaterThanOrEqual(0);
  expect(dialog.x + dialog.width).toBeLessThanOrEqual(320);
  expect(await page.locator('.panel__body').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('the launcher lands without the falling animation when the visitor asked for less motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadWidget(page);
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  await dragTo(page, (await launcher.boundingBox())!, 600, 200);
  expect(await launcher.evaluate((el) => el.getAnimations().length)).toBe(0);
  const box = (await launcher.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height - 8);
});

test('the Powered by Pulxon link sits at the top of the panel and can be followed, not dragged', async ({ page }) => {
  await loadWidget(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const link = page.getByRole('link', { name: /Powered by Pulxon/ });
  const header = (await page.locator('[data-pulxon-drag-handle]').boundingBox())!;
  const box = (await link.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(header.y);
  expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
  expect(box.height).toBeGreaterThanOrEqual(24);
  await expect(link).toHaveAttribute('href', 'https://pulxon.com/?utm_source=widget');
});
