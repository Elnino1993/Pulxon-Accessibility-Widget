import { afterEach, describe, expect, it, vi } from 'vitest';
import { createController } from './controller';
import { createRegistry, type FeatureDefinition, type ProfileDefinition } from './registry';
import { createMemoryStorage } from './storage';
import { SETTINGS_KEY, createSettingsStore } from './store';
import { createStyleEngine } from './style-engine';

function fakeFeature(id: string, levels = 1, conflictsWith: string[] = []) {
  return {
    id,
    group: 'text' as const,
    labelKey: 'feature.highlightLinks' as const,
    levels,
    conflictsWith,
    apply: vi.fn(),
    teardown: vi.fn(),
  } satisfies FeatureDefinition;
}

function setup(features: FeatureDefinition[], profiles: ProfileDefinition[] = [], seed?: string) {
  const storage = createMemoryStorage();
  if (seed) storage.set(SETTINGS_KEY, seed);
  const store = createSettingsStore(storage);
  const registry = createRegistry(features);
  const ctx = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
  const controller = createController({ registry, store, ctx, profiles });
  return { controller, store, storage, ctx };
}

describe('createRegistry', () => {
  it('rejects duplicate ids and invalid levels', () => {
    expect(() => createRegistry([fakeFeature('a'), fakeFeature('a')])).toThrow(/duplicate/);
    expect(() => createRegistry([fakeFeature('b', 0)])).toThrow(/levels/);
  });

  it('lists definitions in insertion order', () => {
    const registry = createRegistry([fakeFeature('a'), fakeFeature('b')]);
    expect(registry.list().map((f) => f.id)).toEqual(['a', 'b']);
    expect(registry.get('b')?.id).toBe('b');
    expect(registry.get('c')).toBeUndefined();
  });

  it('makes conflicts symmetric and validates them', () => {
    const registry = createRegistry([fakeFeature('a'), fakeFeature('b', 1, ['a'])]);
    expect(registry.conflicts('a')).toEqual(['b']);
    expect(registry.conflicts('b')).toEqual(['a']);
    expect(registry.conflicts('missing')).toEqual([]);
    expect(createRegistry([fakeFeature('a', 1, ['ghost'])]).conflicts('a')).toEqual([]);
    expect(() => createRegistry([fakeFeature('a', 1, ['a'])])).toThrow(/itself/);
  });

  it('requires one level label per level when labels are given', () => {
    expect(() => createRegistry([{ ...fakeFeature('a', 2), levelLabelKeys: ['level.left'] }])).toThrow(/levelLabelKeys/);
    expect(() => createRegistry([{ ...fakeFeature('a', 2), levelLabelKeys: ['level.left', 'level.right'] }])).not.toThrow();
  });
});

function silenceConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createController', () => {
  it('enable applies, clamps level and persists', () => {
    const a = fakeFeature('a', 3);
    const { controller, store, ctx } = setup([a]);
    expect(controller.enable('a', 9)).toBe(true);
    expect(a.apply).toHaveBeenCalledWith(ctx, 3);
    expect(store.get().features).toEqual({ a: 3 });
    expect(controller.level('a')).toBe(3);
  });

  it('enable returns false for unknown ids', () => {
    const { controller } = setup([fakeFeature('a')]);
    expect(controller.enable('nope')).toBe(false);
  });

  it('toggle cycles through levels and then off', () => {
    const a = fakeFeature('a', 2);
    const { controller } = setup([a]);
    controller.toggle('a');
    expect(controller.level('a')).toBe(1);
    controller.toggle('a');
    expect(controller.level('a')).toBe(2);
    controller.toggle('a');
    expect(controller.level('a')).toBe(0);
    expect(a.teardown).toHaveBeenCalledOnce();
  });

  it('enabling a feature tears down its conflicts', () => {
    const a = fakeFeature('a');
    const b = fakeFeature('b', 1, ['a']);
    const { controller, store } = setup([a, b]);
    controller.enable('a');
    controller.enable('b');
    expect(a.teardown).toHaveBeenCalledOnce();
    expect(store.get().features).toEqual({ b: 1 });
  });

  it('disable of an inactive feature does nothing', () => {
    const a = fakeFeature('a');
    const { controller } = setup([a]);
    controller.disable('a');
    expect(a.teardown).not.toHaveBeenCalled();
  });

  it('reset tears down all active features', () => {
    const a = fakeFeature('a');
    const b = fakeFeature('b');
    const { controller, store } = setup([a, b]);
    controller.enable('a');
    controller.enable('b');
    controller.reset();
    expect(a.teardown).toHaveBeenCalledOnce();
    expect(b.teardown).toHaveBeenCalledOnce();
    expect(store.get().features).toEqual({});
  });

  it('setProfile applies profile features and a manual change clears the profile', () => {
    const a = fakeFeature('a', 2);
    const b = fakeFeature('b');
    const profile: ProfileDefinition = {
      id: 'low-vision',
      labelKey: 'panel.profiles',
      features: { a: 2, missing: 1 },
    };
    const { controller, store } = setup([a, b], [profile]);
    expect(controller.setProfile('low-vision')).toBe(true);
    expect(store.get()).toMatchObject({ features: { a: 2 }, profile: 'low-vision' });
    controller.enable('b');
    expect(store.get().profile).toBeNull();
    expect(controller.setProfile('unknown')).toBe(false);
    expect(controller.setProfile(null)).toBe(true);
    expect(store.get().features).toEqual({});
  });

  it('applyAll re-applies persisted features and ignores unknown ids', () => {
    const a = fakeFeature('a', 2);
    const seed = JSON.stringify({ v: 1, features: { a: 2, ghost: 1 }, profile: null, lang: null });
    const { controller, ctx } = setup([a], [], seed);
    controller.applyAll();
    expect(a.apply).toHaveBeenCalledWith(ctx, 2);
  });

  it('treats non-finite or non-numeric levels as level 1', () => {
    const a = fakeFeature('a', 3);
    const { controller, store, ctx } = setup([a]);
    expect(controller.enable('a', Number.NaN)).toBe(true);
    expect(a.apply).toHaveBeenLastCalledWith(ctx, 1);
    expect(store.get().features).toEqual({ a: 1 });
    controller.enable('a', Number.POSITIVE_INFINITY);
    expect(store.get().features).toEqual({ a: 1 });
    controller.enable('a', 'abc' as unknown as number);
    expect(store.get().features).toEqual({ a: 1 });
  });

  it('applyAll isolates a throwing feature and drops it from stored settings', () => {
    const errors = silenceConsoleError();
    const bad = fakeFeature('bad');
    bad.apply.mockImplementation(() => {
      throw new Error('boom');
    });
    const good = fakeFeature('good');
    const seed = JSON.stringify({ v: 1, features: { bad: 1, good: 1 }, profile: 'calm', lang: null });
    const { controller, store, ctx } = setup([bad, good], [], seed);
    expect(() => controller.applyAll()).not.toThrow();
    expect(good.apply).toHaveBeenCalledWith(ctx, 1);
    expect(store.get()).toMatchObject({ features: { good: 1 }, profile: null });
    expect(errors).toHaveBeenCalledWith('[pulxon] feature failed', 'bad', expect.any(Error));
  });

  it('enable of a throwing feature returns false and keeps the conflicting feature', () => {
    silenceConsoleError();
    const a = fakeFeature('a');
    const b = fakeFeature('b', 1, ['a']);
    b.apply.mockImplementation(() => {
      throw new Error('boom');
    });
    const { controller, store } = setup([a, b]);
    controller.enable('a');
    expect(controller.enable('b')).toBe(false);
    expect(a.teardown).not.toHaveBeenCalled();
    expect(store.get().features).toEqual({ a: 1 });
  });

  it('reset continues past a throwing teardown and clears the store', () => {
    silenceConsoleError();
    const a = fakeFeature('a');
    a.teardown.mockImplementation(() => {
      throw new Error('boom');
    });
    const b = fakeFeature('b');
    const { controller, store } = setup([a, b]);
    controller.enable('a');
    controller.enable('b');
    expect(() => controller.reset()).not.toThrow();
    expect(b.teardown).toHaveBeenCalledOnce();
    expect(store.get().features).toEqual({});
  });

  it('setProfile skips features whose apply fails', () => {
    silenceConsoleError();
    const a = fakeFeature('a');
    a.apply.mockImplementation(() => {
      throw new Error('boom');
    });
    const b = fakeFeature('b');
    const profile: ProfileDefinition = { id: 'p', labelKey: 'panel.profiles', features: { a: 1, b: 1 } };
    const { controller, store } = setup([a, b], [profile]);
    expect(controller.setProfile('p')).toBe(true);
    expect(store.get()).toMatchObject({ features: { b: 1 }, profile: 'p' });
  });

  it('destroy tears down without clearing persisted settings', () => {
    const a = fakeFeature('a');
    const { controller, storage } = setup([a]);
    controller.enable('a');
    controller.destroy();
    expect(a.teardown).toHaveBeenCalledOnce();
    expect(storage.get(SETTINGS_KEY)).toContain('"a":1');
  });

  it('enabling a feature tears down features that declare a conflict with it', () => {
    const a = fakeFeature('a');
    const b = fakeFeature('b', 1, ['a']);
    const { controller, store } = setup([a, b]);
    controller.enable('b');
    controller.enable('a');
    expect(b.teardown).toHaveBeenCalledOnce();
    expect(store.get().features).toEqual({ a: 1 });
  });

  it('setProfile skips a feature that conflicts with one already applied by the profile', () => {
    const a = fakeFeature('a');
    const b = fakeFeature('b', 1, ['a']);
    const profile: ProfileDefinition = { id: 'p', labelKey: 'panel.profiles', features: { a: 1, b: 1 } };
    const { controller, store } = setup([a, b], [profile]);
    controller.setProfile('p');
    expect(b.apply).not.toHaveBeenCalled();
    expect(store.get().features).toEqual({ a: 1 });
  });

  it('setProfile tears down a feature whose apply failed', () => {
    silenceConsoleError();
    const a = fakeFeature('a');
    a.apply.mockImplementation(() => {
      throw new Error('boom');
    });
    const profile: ProfileDefinition = { id: 'p', labelKey: 'panel.profiles', features: { a: 1 } };
    const { controller } = setup([a], [profile]);
    controller.setProfile('p');
    expect(a.teardown).toHaveBeenCalledOnce();
  });

  it('applyAll drops stored conflicts, tears down failed features and normalizes levels', () => {
    silenceConsoleError();
    const a = fakeFeature('a', 2);
    const b = fakeFeature('b', 1, ['a']);
    const bad = fakeFeature('bad');
    bad.apply.mockImplementation(() => {
      throw new Error('boom');
    });
    const seed = JSON.stringify({ v: 1, features: { a: 5, b: 1, bad: 1 }, profile: 'p', lang: null });
    const { controller, store, ctx } = setup([a, b, bad], [], seed);
    controller.applyAll();
    expect(a.apply).toHaveBeenCalledWith(ctx, 2);
    expect(b.apply).not.toHaveBeenCalled();
    expect(bad.teardown).toHaveBeenCalledOnce();
    expect(store.get()).toMatchObject({ features: { a: 2 }, profile: null });
  });

  it('applyAll keeps the profile when it only normalizes levels', () => {
    const a = fakeFeature('a', 2);
    const seed = JSON.stringify({ v: 1, features: { a: 7 }, profile: 'calm', lang: null });
    const { controller, store } = setup([a], [], seed);
    controller.applyAll();
    expect(store.get()).toMatchObject({ features: { a: 2 }, profile: 'calm' });
  });

  it('refuses unsupported features and keeps their stored level', () => {
    const a = { ...fakeFeature('a'), isSupported: () => false };
    const seed = JSON.stringify({ v: 1, features: { a: 1 }, profile: null, lang: null });
    const profile: ProfileDefinition = { id: 'p', labelKey: 'panel.profiles', features: { a: 1 } };
    const { controller, store } = setup([a], [profile], seed);
    controller.applyAll();
    expect(a.apply).not.toHaveBeenCalled();
    expect(store.get().features).toEqual({ a: 1 });
    expect(controller.enable('a')).toBe(false);
    controller.setProfile('p');
    expect(a.apply).not.toHaveBeenCalled();
  });
});
