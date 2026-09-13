import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PulxonApi } from './api';
import { createWidget } from './create-widget';
import { Emitter } from './core/emitter';
import type { FeatureDefinition } from './core/registry';
import { createMemoryStorage } from './core/storage';
import { SETTINGS_KEY, type Settings } from './core/store';
import { builtinFeatures } from './features';
import { VERSION } from './version';

const apis: PulxonApi[] = [];

function start(storage = createMemoryStorage(), features?: FeatureDefinition[]): PulxonApi {
  const holder: { api?: PulxonApi } = {};
  act(() => {
    holder.api = createWidget({ storage, features, styleMode: 'style-tag' });
  });
  if (!holder.api) throw new Error('createWidget failed');
  apis.push(holder.api);
  return holder.api;
}

function hasStyle(id: string): boolean {
  return document.head.querySelector(`style[data-pulxon-style="${id}"]`) !== null;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const api of apis.splice(0)) api.destroy();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('createWidget', () => {
  it('returns a frozen API with the package version', () => {
    const api = start();
    expect(api.version).toBe(VERSION);
    expect(Object.isFrozen(api)).toBe(true);
    expect(document.getElementById('pulxon-root')).not.toBeNull();
  });

  it('enables and toggles features and emits change events', () => {
    const api = start();
    const changes: Settings[] = [];
    api.on('change', (settings) => changes.push(settings));

    expect(api.enable('highlight-links')).toBe(true);
    expect(hasStyle('highlight-links')).toBe(true);
    expect(changes.at(-1)?.features).toEqual({ 'highlight-links': 1 });

    expect(api.enable('does-not-exist')).toBe(false);

    api.toggleFeature('highlight-links');
    expect(api.getSettings().features).toEqual({});
    expect(hasStyle('highlight-links')).toBe(false);

    api.enable('pause-animations');
    api.reset();
    expect(api.getSettings().features).toEqual({});
  });

  it('restores persisted settings on start and tears them down on destroy', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: { 'pause-animations': 1 }, profile: null, lang: null }));
    const api = start(storage);
    expect(hasStyle('pause-animations')).toBe(true);
    api.destroy();
    expect(hasStyle('pause-animations')).toBe(false);
    expect(document.getElementById('pulxon-root')).toBeNull();
    expect(storage.get(SETTINGS_KEY)).toContain('pause-animations');
    expect(() => api.destroy()).not.toThrow();
  });

  it('does not expose mutable internal settings', () => {
    const api = start();
    expect(Object.isFrozen(api.getSettings())).toBe(true);
    expect(Object.isFrozen(api.getSettings().features)).toBe(true);
    api.enable('highlight-links');
    expect(Object.isFrozen(api.getSettings().features)).toBe(true);
  });

  it('starts even when a persisted feature throws while applying', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const throwing: FeatureDefinition = {
      id: 'throwing',
      group: 'text',
      labelKey: 'feature.highlightLinks',
      levels: 1,
      apply: () => {
        throw new Error('boom');
      },
      teardown: () => undefined,
    };
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: { throwing: 1, 'highlight-links': 1 }, profile: null, lang: null }));
    const api = start(storage, [throwing, ...builtinFeatures]);
    expect(hasStyle('highlight-links')).toBe(true);
    expect(api.getSettings().features).toEqual({ 'highlight-links': 1 });
  });

  it('marks the resolved widget language in the DOM', () => {
    act(() => {
      apis.push(createWidget({ options: { lang: 'es-MX' }, storage: createMemoryStorage(), styleMode: 'style-tag' }));
    });
    const mountPoint = document.getElementById('pulxon-root')?.shadowRoot?.querySelector('button.launcher')?.parentElement;
    expect(mountPoint?.getAttribute('lang')).toBe('es');
  });

  it('turns the API into no-ops after destroy', () => {
    const api = start();
    api.destroy();
    expect(api.enable('highlight-links')).toBe(false);
    expect(hasStyle('highlight-links')).toBe(false);
    expect(api.setProfile(null)).toBe(false);
    const listener = vi.fn();
    const off = api.on('change', listener);
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
    expect(() => {
      api.open();
      api.toggle();
      api.close();
      api.reset();
      api.disable('highlight-links');
      api.toggleFeature('highlight-links');
    }).not.toThrow();
    expect(hasStyle('highlight-links')).toBe(false);
    expect(document.getElementById('pulxon-root')).toBeNull();
    expect(api.version).toBe(VERSION);
    expect(api.getSettings().features).toEqual({});
  });

  it('calls onDestroy exactly once', () => {
    const onDestroy = vi.fn();
    const holder: { api?: PulxonApi } = {};
    act(() => {
      holder.api = createWidget({ storage: createMemoryStorage(), styleMode: 'style-tag', onDestroy });
    });
    holder.api?.destroy();
    holder.api?.destroy();
    expect(onDestroy).toHaveBeenCalledOnce();
  });

  it('calls onDestroy even when teardown throws', () => {
    const onDestroy = vi.fn();
    const holder: { api?: PulxonApi } = {};
    act(() => {
      holder.api = createWidget({ storage: createMemoryStorage(), styleMode: 'style-tag', onDestroy });
    });
    vi.spyOn(Emitter.prototype, 'clear').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => holder.api?.destroy()).toThrow('boom');
    expect(onDestroy).toHaveBeenCalledOnce();
  });

  it('normalizes invalid levels passed through the public API', () => {
    const api = start();
    expect(api.enable('highlight-links', Number.NaN)).toBe(true);
    expect(api.getSettings().features).toEqual({ 'highlight-links': 1 });
  });

  it('emits open/close events and dispatches DOM change events', () => {
    const api = start();
    const seen: string[] = [];
    api.on('open', () => seen.push('open'));
    api.on('close', () => seen.push('close'));
    const domEvents: Event[] = [];
    const onChange = (event: Event) => domEvents.push(event);
    document.addEventListener('pulxon:change', onChange);

    act(() => api.open());
    act(() => api.close());
    api.enable('highlight-links');

    document.removeEventListener('pulxon:change', onChange);
    expect(seen).toEqual(['open', 'close']);
    expect(domEvents).toHaveLength(1);
    expect((domEvents[0] as CustomEvent<Settings>).detail.features).toEqual({ 'highlight-links': 1 });
  });
});
