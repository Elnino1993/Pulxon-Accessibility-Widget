import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { PulxonApi } from './api';
import { createWidget } from './create-widget';
import { createMemoryStorage } from './core/storage';
import { SETTINGS_KEY, type Settings } from './core/store';
import { VERSION } from './version';

const apis: PulxonApi[] = [];

function start(storage = createMemoryStorage()): PulxonApi {
  const holder: { api?: PulxonApi } = {};
  act(() => {
    holder.api = createWidget({ storage, styleMode: 'style-tag' });
  });
  if (!holder.api) throw new Error('createWidget failed');
  apis.push(holder.api);
  return holder.api;
}

function hasStyle(id: string): boolean {
  return document.head.querySelector(`style[data-pulxon-style="${id}"]`) !== null;
}

afterEach(() => {
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
