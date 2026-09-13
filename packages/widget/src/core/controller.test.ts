import { describe, expect, it, vi } from 'vitest';
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

  it('destroy tears down without clearing persisted settings', () => {
    const a = fakeFeature('a');
    const { controller, storage } = setup([a]);
    controller.enable('a');
    controller.destroy();
    expect(a.teardown).toHaveBeenCalledOnce();
    expect(storage.get(SETTINGS_KEY)).toContain('"a":1');
  });
});
