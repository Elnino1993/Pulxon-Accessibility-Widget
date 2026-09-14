import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ORIGIN = 'https://fixture.pulxon.test';

const DIST = new URL('../dist/', import.meta.url);

export const BUNDLE = readFileSync(fileURLToPath(new URL('pulxon.min.js', DIST)), 'utf8');

export const DEFAULT_BODY =
  '<main><h1>Fixture page</h1><p>Read the <a href="#docs">documentation</a>.</p>' +
  '<button id="my-trigger" type="button">Accessibility options</button></main>';

export function pageHtml(scripts: string, head = '', body = DEFAULT_BODY): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture</title>' +
    head +
    '</head><body>' +
    body +
    scripts +
    '</body></html>'
  );
}

export async function serve(page: Page, html: string, headers: Record<string, string> = {}): Promise<void> {
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', headers, body: html }),
  );
  await page.route(`${ORIGIN}/pulxon.min.js`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: BUNDLE }),
  );
  await page.route(`${ORIGIN}/fonts/*`, (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    return route.fulfill({ status: 200, contentType: 'font/woff2', path: fileURLToPath(new URL(`fonts/${name}`, DIST)) });
  });
}

export async function loadWidget(page: Page, attributes: Record<string, string> = {}): Promise<void> {
  const attrs = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
  await serve(page, pageHtml(`<script src="/pulxon.min.js"${attrs}></script>`));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => 'Pulxon' in window);
}
