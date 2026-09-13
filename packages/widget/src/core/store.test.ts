import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from './storage';
import { EMPTY_SETTINGS, SETTINGS_KEY, createSettingsStore, parseSettings, type Settings } from './store';

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

  it('returns a distinct frozen object each time', () => {
    const first = parseSettings(null);
    const second = parseSettings(null);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.features)).toBe(true);
    const parsed = parseSettings(JSON.stringify({ v: 1, features: { a: 1 }, profile: null, lang: null }));
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.features)).toBe(true);
  });
});

describe('createSettingsStore', () => {
  it('loads existing settings', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: { y: 1 }, profile: null, lang: 'es' }));
    expect(createSettingsStore(storage).get()).toEqual({ v: 1, features: { y: 1 }, profile: null, lang: 'es' });
  });

  it('keeps state frozen after load and after updates', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: { y: 1 }, profile: null, lang: null }));
    const store = createSettingsStore(storage);
    expect(Object.isFrozen(store.get())).toBe(true);
    expect(Object.isFrozen(store.get().features)).toBe(true);
    let seen: Settings | undefined;
    store.subscribe((s) => {
      seen = s;
    });
    store.update((s) => ({ ...s, features: { ...s.features, z: 2 } }));
    expect(Object.isFrozen(store.get())).toBe(true);
    expect(Object.isFrozen(store.get().features)).toBe(true);
    expect(seen).toBe(store.get());
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
