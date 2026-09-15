import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { fetchRemoteConfig, parseRemoteConfig, remoteConfigUrl } from './remote-config';

// Vite statically rewrites the literal `new URL('...', import.meta.url)` pattern into a
// dev-server asset URL (http://localhost:.../@fs/...), which breaks Node's fs.readFileSync
// in this Vite-powered test runner. Building the path via fileURLToPath sidesteps that
// static transform and keeps this pointed at the real file on disk.
const CONTRACT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../contracts/widget-config.v1.json');
const CONTRACT = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as unknown;
const SITE_KEY = 'pk_test_abcdefgh1234';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

describe('parseRemoteConfig', () => {
  it('accepts the shared contract example', () => {
    expect(parseRemoteConfig(CONTRACT)).toEqual({
      position: 'bottom-left',
      mobilePosition: 'bottom-center',
      offsetX: 24,
      offsetY: 16,
      color: '#0f766e',
      size: 'large',
      icon: 'eye',
      lang: 'es',
      hideOnMobile: false,
      disabledFeatures: ['read-aloud', 'hide-images'],
      branding: false,
    });
  });

  it('drops invalid and unknown fields but keeps valid ones', () => {
    expect(
      parseRemoteConfig({
        version: 1,
        widget: { color: 'red', size: 'huge', icon: 'eye', trigger: '#x', nonce: 'n', zIndex: 1, siteKey: 'pk_live_zzzzzzzz', offsetX: 999, disabledFeatures: 'read-aloud', branding: true },
      }),
    ).toEqual({ icon: 'eye', branding: true });
  });

  it('rejects other versions and shapes', () => {
    for (const value of [null, 'x', [], { version: 2, widget: {} }, { version: 1 }, { version: 1, widget: [] }]) {
      expect(parseRemoteConfig(value), JSON.stringify(value)).toBeNull();
    }
    expect(parseRemoteConfig({ version: 1, widget: {} })).toEqual({});
  });
});

describe('remoteConfigUrl', () => {
  it('builds the config URL under the API base', () => {
    expect(remoteConfigUrl(SITE_KEY, 'https://api.pulxon.com')).toBe(`https://api.pulxon.com/v1/sites/${SITE_KEY}/config`);
    expect(remoteConfigUrl(SITE_KEY, 'http://localhost:3000/')).toBe(`http://localhost:3000/v1/sites/${SITE_KEY}/config`);
    expect(remoteConfigUrl(SITE_KEY, 'https://example.com/pulxon')).toBe(`https://example.com/pulxon/v1/sites/${SITE_KEY}/config`);
  });

  it('refuses non-http bases and invalid site keys', () => {
    expect(remoteConfigUrl(SITE_KEY, 'javascript:alert(1)')).toBeNull();
    expect(remoteConfigUrl('../../admin', 'https://api.pulxon.com')).toBeNull();
  });
});

describe('fetchRemoteConfig', () => {
  it('fetches without credentials and parses the config', async () => {
    const fetch = vi.fn(async () => jsonResponse(CONTRACT));
    const result = await fetchRemoteConfig({ siteKey: SITE_KEY, apiBase: 'https://api.pulxon.com', fetch });
    expect(result).toMatchObject({ color: '#0f766e', branding: false });
    expect(fetch).toHaveBeenCalledWith(`https://api.pulxon.com/v1/sites/${SITE_KEY}/config`, expect.objectContaining({ method: 'GET', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }));
  });

  it('returns null on HTTP errors, bad JSON and network failures', async () => {
    const cases = [
      vi.fn(async () => jsonResponse({ error: 'nope' }, { status: 404 })),
      vi.fn(async () => new Response('not json', { status: 200 })),
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    ];
    for (const fetch of cases) {
      expect(await fetchRemoteConfig({ siteKey: SITE_KEY, apiBase: 'https://api.pulxon.com', fetch })).toBeNull();
    }
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(() => new Promise<Response>(() => undefined));
      const pending = fetchRemoteConfig({ siteKey: SITE_KEY, apiBase: 'https://api.pulxon.com', fetch, timeoutMs: 3000 });
      await vi.advanceTimersByTimeAsync(3000);
      await expect(pending).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not call fetch for an unusable URL', async () => {
    const fetch = vi.fn();
    expect(await fetchRemoteConfig({ siteKey: SITE_KEY, apiBase: 'ftp://x', fetch })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
