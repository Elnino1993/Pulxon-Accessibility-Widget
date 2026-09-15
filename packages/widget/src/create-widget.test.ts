import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PulxonApi } from './api';
import type { WidgetOptions } from './config/options';
import { createWidget, filterFeatures, filterProfiles } from './create-widget';
import { Emitter } from './core/emitter';
import type { FeatureDefinition } from './core/registry';
import { createMemoryStorage } from './core/storage';
import { SETTINGS_KEY, type Settings } from './core/store';
import { builtinFeatures } from './features';
import { builtinProfiles } from './profiles';
import { VERSION } from './version';

const apis: PulxonApi[] = [];

function start(
  storage = createMemoryStorage(),
  features?: FeatureDefinition[],
  options?: Partial<WidgetOptions>,
): PulxonApi {
  const holder: { api?: PulxonApi } = {};
  act(() => {
    holder.api = createWidget({ storage, features, styleMode: 'style-tag', options });
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

  it('keeps reading overlays below a custom widget z-index', () => {
    const api = start(createMemoryStorage(), undefined, { zIndex: 500 });
    api.enable('reading-guide');
    const style = document.head.querySelector('style[data-pulxon-style="reading-guide"]');
    expect(style?.textContent).toContain('z-index:499!important');
  });

  it('ships the built-in profiles by default', () => {
    const api = start();
    expect(api.setProfile('seizure-safe')).toBe(true);
    expect(api.getSettings()).toMatchObject({
      profile: 'seizure-safe',
      features: { 'pause-animations': 1, saturation: 1 },
    });
    expect(hasStyle('saturation')).toBe(true);
  });
});

describe('connected-mode rendering', () => {
  it('removes disabled features from the registry and the panel', () => {
    const api = start(createMemoryStorage(), undefined, { disabledFeatures: ['highlight-links', 'read-aloud'] });
    expect(api.enable('highlight-links')).toBe(false);
    expect(api.enable('bold-text')).toBe(true);
    act(() => api.open());
    const shadow = document.getElementById('pulxon-root')?.shadowRoot;
    expect(shadow?.querySelector('[data-feature="highlight-links"]')).toBeNull();
    expect(shadow?.querySelector('[data-feature="bold-text"]')).not.toBeNull();
  });

  it('does not re-apply a stored setting for a disabled feature', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: { 'bold-text': 1 }, profile: null, lang: null }));
    start(storage, undefined, { disabledFeatures: ['bold-text'] });
    expect(hasStyle('bold-text')).toBe(false);
  });

  it('keeps profiles consistent with disabled features', () => {
    const profiles = filterProfiles(builtinProfiles, ['pause-animations', 'bigger-text']);
    expect(profiles.map((p) => p.id)).toEqual(['dyslexia', 'keyboard']);
    expect(profiles.find((p) => p.id === 'seizure-safe')).toBeUndefined();
    expect(profiles.find((p) => p.id === 'adhd')).toBeUndefined();
    expect(profiles.find((p) => p.id === 'low-vision')).toBeUndefined();
    expect(filterFeatures(builtinFeatures, ['bold-text']).some((f) => f.id === 'bold-text')).toBe(false);
    expect(filterProfiles(builtinProfiles, [])).toEqual(builtinProfiles);
  });

  it('hides the branding link when branding is off', () => {
    const api = start(createMemoryStorage(), undefined, { branding: false });
    act(() => api.open());
    const shadow = document.getElementById('pulxon-root')?.shadowRoot;
    expect(shadow?.textContent).not.toContain('Powered by Pulxon');
    expect(shadow?.querySelector('.reset')).not.toBeNull();
  });

  it('renders the chosen icon and mobile position', () => {
    start(createMemoryStorage(), undefined, { icon: 'eye', mobilePosition: 'bottom-center', position: 'top-right' });
    const launcher = document.getElementById('pulxon-root')?.shadowRoot?.querySelector('.launcher');
    expect(launcher?.className).toContain('launcher--top-right');
    expect(launcher?.className).toContain('launcher--m-bottom-center');
    expect(launcher?.querySelector('svg')?.getAttribute('data-icon')).toBe('eye');
    expect(launcher?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
