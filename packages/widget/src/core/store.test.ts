import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from './storage';
import { EMPTY_SETTINGS, SETTINGS_KEY, createSettingsStore, parseSettings } from './store';

describe('parseSettings', () => {
  it('returns empty settings for missing, broken or unknown-version data', () => {
    for (const raw of [null, '{bad', '{"v":2}', '[]', '"text"']) {
      expect(parseSettings(raw)).toEqual(EMPTY_SETTINGS);
    }
  });

  it('keeps only valid feature levels and fields', () => {
    const raw = JSON.stringify({
      v: 1,
      features: { a: 2, b: 0, c: 1.5, d: '3', e: 11 },
      profile: 'adhd',
      lang: 5,
    });
    expect(parseSettings(raw)).toEqual({ v: 1, features: { a: 2 }, profile: 'adhd', lang: null });
  });

  it('returns a fresh object each time', () => {
    const first = parseSettings(null);
    first.features.x = 1;
    expect(parseSettings(null).features).toEqual({});
  });
});

describe('createSettingsStore', () => {
  it('loads existing settings', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: { y: 1 }, profile: null, lang: 'es' }));
    expect(createSettingsStore(storage).get()).toEqual({ v: 1, features: { y: 1 }, profile: null, lang: 'es' });
  });

  it('persists updates and notifies subscribers until unsubscribed', () => {
    const storage = createMemoryStorage();
    const store = createSettingsStore(storage);
    const seen: number[] = [];
    const off = store.subscribe((s) => seen.push(s.features.x ?? 0));

    store.update((s) => ({ ...s, features: { ...s.features, x: 2 } }));
    off();
    store.update((s) => ({ ...s, features: {} }));

    expect(seen).toEqual([2]);
    expect(parseSettings(storage.get(SETTINGS_KEY))).toEqual(EMPTY_SETTINGS);
  });
});
