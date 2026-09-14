import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ORIGIN, pageHtml, serve } from './fixture';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const BODY =
  '<header><nav aria-label="Primary"><a href="#home">Home</a></nav></header>' +
  '<main><h1>Features fixture</h1><h2>Details</h2>' +
  '<p id="text" style="font-size:16px">Plain paragraph text for testing.</p>' +
  '<p id="rem-text" style="font-size:1rem">Rem paragraph.</p>' +
  '<a id="link" href="#docs">documentation</a>' +
  '<img id="img" alt="Example" width="10" height="10" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">' +
  '</main><footer>Footer</footer>';

async function load(page: Page): Promise<void> {
  await serve(page, pageHtml('<script src="/pulxon.min.js"></script>', '', BODY));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
}

async function enable(page: Page, id: string, level = 1): Promise<void> {
  const enabled = await page.evaluate(([feature, value]) => window.Pulxon?.enable(feature, value) ?? false, [id, level] as const);
  expect(enabled, `enable ${id}`).toBe(true);
}

function htmlFilter(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).filter);
}

test('text features change computed styles and reset restores the page', async ({ page }) => {
  await load(page);
  const text = page.locator('#text');

  await enable(page, 'bold-text');
  await expect(text).toHaveCSS('font-weight', '700');
  await enable(page, 'line-height', 2);
  await expect(text).toHaveCSS('line-height', '28px');
  await enable(page, 'text-spacing', 1);
  await expect(text).toHaveCSS('letter-spacing', '1.92px');
  await expect(text).toHaveCSS('word-spacing', '2.56px');
  await enable(page, 'text-align', 3);
  await expect(text).toHaveCSS('text-align', 'center');
  await enable(page, 'bigger-text', 1);
  await expect(text).toHaveCSS('font-size', '19.2px');
  await expect(page.locator('#rem-text')).toHaveCSS('font-size', '19.2px');

  await page.evaluate(() => window.Pulxon?.reset());
  await expect(text).toHaveCSS('font-weight', '400');
  await expect(text).toHaveCSS('font-size', '16px');
  expect(await text.evaluate((el) => (el as HTMLElement).style.getPropertyValue('font-size'))).toBe('16px');
  expect(await page.locator('#rem-text').evaluate((el) => (el as HTMLElement).style.getPropertyValue('font-size'))).toBe('1rem');
});

test('bigger text scales content added after it was enabled', async ({ page }) => {
  await load(page);
  await enable(page, 'bigger-text', 2);
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.id = 'late';
    p.textContent = 'Late';
    p.style.setProperty('font-size', '10px');
    document.querySelector('main')?.appendChild(p);
  });
  await expect(page.locator('#late')).toHaveCSS('font-size', '14px');
});

test('contrast and saturation combine and each can be removed independently', async ({ page }) => {
  await load(page);
  await enable(page, 'contrast', 1);
  await enable(page, 'saturation', 3);
  expect(await htmlFilter(page)).toContain('invert(1)');
  expect(await htmlFilter(page)).toContain('grayscale(1)');

  await page.evaluate(() => window.Pulxon?.disable('saturation'));
  expect(await htmlFilter(page)).toContain('invert(1)');
  expect(await htmlFilter(page)).not.toContain('grayscale');

  await enable(page, 'contrast', 2);
  await expect(page.locator('#text')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('#text')).toHaveCSS('color', 'rgb(255, 255, 255)');

  await enable(page, 'hide-images');
  await expect(page.locator('#img')).toHaveCSS('visibility', 'hidden');
});

test('inverted contrast keeps the widget and the reading mask in their real colors', async ({ page }) => {
  await load(page);
  const launcher = page.getByRole('button', { name: 'Open accessibility menu' });
  const filterOf = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).filter);

  await enable(page, 'contrast', 1);
  expect(await launcher.evaluate((el) => getComputedStyle(el).filter)).toContain('invert(1)');
  await expect(launcher).toHaveCSS('position', 'fixed');
  const viewport = page.viewportSize();
  const box = await launcher.boundingBox();
  expect(box?.x ?? 0).toBeGreaterThan((viewport?.width ?? 0) - 100);
  expect(box?.y ?? 0).toBeGreaterThan((viewport?.height ?? 0) - 100);

  await enable(page, 'reading-mask');
  expect(await filterOf('.pulxon-reading-mask--top')).toContain('invert(1)');

  await launcher.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await page.locator('.panel').evaluate((el) => getComputedStyle(el).filter)).toContain('invert(1)');
  const panelBox = await page.locator('.panel').boundingBox();
  expect(panelBox?.y).toBe(0);
  expect(panelBox?.height).toBe(viewport?.height);
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.Pulxon?.disable('contrast'));
  expect(await launcher.evaluate((el) => getComputedStyle(el).filter)).toBe('none');
});

test('navigation helpers and the big cursor style the page', async ({ page }) => {
  await load(page);
  await enable(page, 'highlight-headings');
  await expect(page.locator('h1')).toHaveCSS('outline-style', 'dashed');

  await enable(page, 'big-cursor');
  expect(await page.locator('#text').evaluate((el) => getComputedStyle(el).cursor)).toContain('data:image/svg+xml');
  expect(await page.locator('#link').evaluate((el) => getComputedStyle(el).cursor)).toContain('pointer');

  await enable(page, 'focus-highlight');
  await page.keyboard.press('Tab');
  const home = page.getByRole('link', { name: 'Home' });
  await expect(home).toBeFocused();
  await expect(home).toHaveCSS('outline-width', '4px');
});

test('the dyslexia font loads from the fonts folder next to the script', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/fonts/')) fontRequests.push(request.url());
  });
  await load(page);
  await enable(page, 'dyslexia-font');
  await expect(page.locator('#text')).toHaveCSS('font-family', /Pulxon OpenDyslexic/);
  await page.evaluate(async () => {
    await document.fonts.load('16px "Pulxon OpenDyslexic"');
  });
  expect(await page.evaluate(() => document.fonts.check('16px "Pulxon OpenDyslexic"'))).toBe(true);
  expect(fontRequests).toContain(`${ORIGIN}/fonts/opendyslexic-latin-400-normal.woff2`);
});

test('the reading mask follows the pointer and is replaced by the reading guide', async ({ page }) => {
  await load(page);
  await enable(page, 'reading-mask');
  await page.mouse.move(200, 300);
  await expect
    .poll(() => page.locator('.pulxon-reading-mask--top').evaluate((el) => el.getBoundingClientRect().height))
    .toBe(240);

  await enable(page, 'reading-guide');
  await expect(page.locator('.pulxon-reading-mask')).toHaveCount(0);
  await expect(page.locator('.pulxon-reading-guide')).toHaveCount(1);
  expect(await page.evaluate(() => window.Pulxon?.getSettings().features)).toEqual({ 'reading-guide': 1 });
});

test('the reading mask does not jump when focus moves into the widget', async ({ page }) => {
  await load(page);
  await enable(page, 'reading-mask');
  await page.mouse.move(200, 300);
  const topHeight = () => page.locator('.pulxon-reading-mask--top').evaluate((el) => el.getBoundingClientRect().height);
  await expect.poll(topHeight).toBe(240);

  await page.keyboard.press('Alt+A');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(topHeight).toBe(240);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(topHeight).toBe(240);
});

test('read aloud speaks the clicked paragraph through the Web Speech API', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    class FakeUtterance {
      text: string;
      rate = 1;
      lang = '';
      onend: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, '__spoken', { value: spoken });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      value: { speak: (utterance: FakeUtterance) => spoken.push(`${utterance.rate}:${utterance.text}`), cancel: () => undefined },
      configurable: true,
    });
  });
  await load(page);
  await enable(page, 'read-aloud', 2);
  await page.locator('#text').click();
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual([
    '1.5:Plain paragraph text for testing.',
  ]);
  await expect(page.locator('#text')).toHaveAttribute('data-pulxon-reading', '');
});

test('page structure is accessible and moves focus to the chosen heading', async ({ page }) => {
  await load(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  await page.getByRole('button', { name: 'Page structure' }).click();
  const headingsTab = page.getByRole('tab', { name: 'Headings' });
  await expect(headingsTab).toHaveAttribute('aria-selected', 'true');

  const results = await new AxeBuilder({ page }).include('#pulxon-root').withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);

  await headingsTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Landmarks' })).toBeFocused();
  await page.getByRole('tab', { name: 'Landmarks' }).press('ArrowLeft');
  await expect(headingsTab).toBeFocused();

  await page.getByRole('button', { name: /Details/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Details' })).toBeFocused();
});

test('profiles apply their feature sets and the panel stays axe-clean with every feature on', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await load(page);
  await page.getByRole('button', { name: 'Open accessibility menu' }).click();
  const adhd = page.getByRole('button', { name: 'ADHD friendly' });
  await adhd.click();
  await expect(adhd).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pulxon-reading-mask')).toHaveCount(2);
  expect(await htmlFilter(page)).toContain('saturate(0.5)');

  for (const id of [
    'bigger-text',
    'text-spacing',
    'line-height',
    'text-align',
    'dyslexia-font',
    'bold-text',
    'contrast',
    'saturation',
    'highlight-links',
    'highlight-headings',
    'focus-highlight',
    'reading-guide',
    'big-cursor',
    'pause-animations',
    'hide-images',
  ]) {
    await enable(page, id);
  }
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page }).include('#pulxon-root').withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});
