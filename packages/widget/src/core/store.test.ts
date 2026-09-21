import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from './storage';
import { DEFAULT_UI_SETTINGS, EMPTY_SETTINGS, SETTINGS_KEY, createSettingsStore, parseSettings, readStoredVersion, type Settings } from './store';

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
    expect(parseSettings(raw)).toEqual({ v: 1, features: { a: 2 }, profile: 'adhd', lang: null, ui: DEFAULT_UI_SETTINGS });
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
    expect(createSettingsStore(storage).get()).toEqual({ v: 1, features: { y: 1 }, profile: null, lang: 'es', ui: DEFAULT_UI_SETTINGS });
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

describe('ui settings', () => {
  it('defaults the ui settings and keeps them across a reload', () => {
    const storage = createMemoryStorage();
    const store = createSettingsStore(storage);
    expect(store.get().ui).toEqual({ scale: 'normal', position: null, launcher: null, panel: null });

    store.update((settings) => ({ ...settings, ui: { scale: 'large', position: 'bottom-left', launcher: null, panel: null } }));
    expect(createSettingsStore(storage).get().ui).toEqual({ scale: 'large', position: 'bottom-left', launcher: null, panel: null });
  });

  it('ignores a stored ui object with unknown values', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: {}, profile: null, lang: null, ui: { scale: 'huge', position: 'orbit' } }));
    expect(createSettingsStore(storage).get().ui).toEqual({ scale: 'normal', position: null, launcher: null, panel: null });
  });

  it('falls back per field rather than discarding the whole ui object', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: {}, profile: null, lang: null, ui: { scale: 'large', position: 'orbit' } }));
    expect(createSettingsStore(storage).get().ui).toEqual({ scale: 'large', position: null, launcher: null, panel: null });
  });

  it('keeps where the visitor dragged the launcher and the panel across a reload', () => {
    const storage = createMemoryStorage();
    const store = createSettingsStore(storage);
    store.update((settings) => ({ ...settings, ui: { ...settings.ui, launcher: { x: 0.25, y: 1 }, panel: { x: 0, y: 0.5 } } }));
    expect(createSettingsStore(storage).get().ui).toEqual({ scale: 'normal', position: null, launcher: { x: 0.25, y: 1 }, panel: { x: 0, y: 0.5 } });
  });

  it('drops a stored drag spot that is not two fractions between 0 and 1', () => {
    const storage = createMemoryStorage();
    storage.set(
      SETTINGS_KEY,
      JSON.stringify({ v: 1, features: {}, profile: null, lang: null, ui: { scale: 'normal', position: null, launcher: { x: 2, y: 0.5 }, panel: { x: '0.1', y: 0 } } }),
    );
    expect(createSettingsStore(storage).get().ui).toEqual({ scale: 'normal', position: null, launcher: null, panel: null });
  });
});

describe('readStoredVersion', () => {
  it('returns the integer schema version or null', () => {
    expect(readStoredVersion(null)).toBeNull();
    expect(readStoredVersion('{bad')).toBeNull();
    expect(readStoredVersion('[]')).toBeNull();
    expect(readStoredVersion('{"v":"2"}')).toBeNull();
    expect(readStoredVersion('{"v":1.5}')).toBeNull();
    expect(readStoredVersion('{"v":2}')).toBe(2);
  });
});

describe('createSettingsStore with newer data', () => {
  it('never overwrites settings written by a newer widget version', () => {
    const storage = createMemoryStorage();
    const newer = JSON.stringify({ v: 2, features: { 'x-new': 1 }, theme: 'dark' });
    storage.set(SETTINGS_KEY, newer);
    const store = createSettingsStore(storage);
    const seen: Settings[] = [];
    store.subscribe((s) => seen.push(s));

    expect(store.get()).toEqual(EMPTY_SETTINGS);
    store.update((s) => ({ ...s, features: { a: 1 } }));

    expect(store.get().features).toEqual({ a: 1 });
    expect(seen).toHaveLength(1);
    expect(storage.get(SETTINGS_KEY)).toBe(newer);
  });

  it('still persists over unreadable data', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, '{bad');
    const store = createSettingsStore(storage);
    store.update((s) => ({ ...s, features: { a: 1 } }));
    expect(parseSettings(storage.get(SETTINGS_KEY)).features).toEqual({ a: 1 });
  });
});

