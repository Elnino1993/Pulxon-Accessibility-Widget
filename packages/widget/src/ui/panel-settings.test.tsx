import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveOptions, type WidgetOptions } from '../config/options';
import { createController } from '../core/controller';
import { createRegistry, type FeatureDefinition, type ProfileDefinition } from '../core/registry';
import { createMemoryStorage, type KeyValueStorage } from '../core/storage';
import { createSettingsStore } from '../core/store';
import { createStyleEngine } from '../core/style-engine';
import { highlightLinks, pauseAnimations } from '../features';
import { createTranslator } from '../i18n';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLocaleLoader, LANGUAGES } from '../i18n';
import { mountUI, type UiHandle } from './mount';

/** Serves `locales/<code>.json` from the package, the way the built widget fetches them. */
const localLocales = () =>
  createLocaleLoader('https://widget.test/locales/', (url) => {
    const code = url.slice(url.lastIndexOf('/') + 1);
    const body = JSON.parse(readFileSync(join(__dirname, '..', '..', 'locales', code), 'utf8')) as unknown;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });

const handles: UiHandle[] = [];

function setup(
  features: FeatureDefinition[] = [highlightLinks, pauseAnimations],
  profiles: ProfileDefinition[] = [],
  options: Partial<WidgetOptions> = {},
  storage: KeyValueStorage = createMemoryStorage(),
) {
  const store = createSettingsStore(storage);
  const registry = createRegistry(features);
  const styles = createStyleEngine(document, { mode: 'style-tag' });
  const controller = createController({ registry, store, ctx: { doc: document, styles }, profiles });
  const holder: { ui?: UiHandle } = {};
  act(() => {
    holder.ui = mountUI({
      doc: document,
      options: resolveOptions({}, options),
      controller,
      registry,
      store,
      profiles,
      t: createTranslator('en'),
      styleMode: 'style-tag',
      locales: localLocales(),
    });
  });
  const ui = holder.ui;
  if (!ui) throw new Error('mount failed');
  handles.push(ui);
  const host = ui.host;
  if (!host.shadowRoot) throw new Error('missing shadow root');
  act(() => ui.open());
  return { ui, host, controller, store };
}

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('PanelSettings', () => {
  it('lays the panel out right to left in Arabic, Persian, Hebrew and Urdu', async () => {
    const { host } = setup();
    const select = host.shadowRoot!.querySelector<HTMLSelectElement>('[data-pulxon-lang-picker]')!;
    await act(async () => {
      select.value = 'ar';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // The mount point inside the shadow root carries the panel's lang and dir; the panel inherits it.
    const mountPoint = () => host.shadowRoot!.querySelector('div[lang]')!;
    expect(mountPoint().getAttribute('lang')).toBe('ar');
    expect(mountPoint().getAttribute('dir')).toBe('rtl');
    await act(async () => {
      select.value = 'de';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(mountPoint().getAttribute('lang')).toBe('de');
    expect(mountPoint().getAttribute('dir')).toBe('ltr');
  });

  it('offers the languages the widget ships', async () => {
    const { host } = setup();
    const select = host.shadowRoot!.querySelector<HTMLSelectElement>('[data-pulxon-lang-picker]')!;
    expect([...select.options].map((option) => option.value)).toEqual(['auto', ...LANGUAGES.map((language) => language.code)]);
    expect(select.options.length).toBe(54);
    // Each language in its own name first, then in English, so a visitor finds theirs whatever
    // language the panel is showing.
    expect([...select.options].find((option) => option.value === 'de')?.textContent).toBe('Deutsch (German)');
  });

  it('makes the widget larger and remembers it', async () => {
    const { host, store } = setup();
    const large = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-scale="large"]')!;
    await act(async () => large.click());
    expect(store.get().ui.scale).toBe('large');
    expect(large.getAttribute('aria-pressed')).toBe('true');
  });

  it('moves the launcher and remembers it', async () => {
    const { host, store } = setup();
    // Not bottom-left: that is where the default already puts it, so clicking it would leave the
    // launcher exactly where it was and this test would no longer be about moving anything.
    const spot = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="bottom-right"]')!;
    await act(async () => spot.click());
    expect(store.get().ui.position).toBe('bottom-right');
  });

  it('offers the three spots along the bottom, and only those', () => {
    const { host } = setup();
    const buttons = [...host.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-pulxon-position]')];
    expect(buttons.map((button) => button.dataset.pulxonPosition)).toEqual(['bottom-left', 'bottom-center', 'bottom-right']);
    expect(buttons.map((button) => button.textContent)).toEqual(['Left', 'Center', 'Right']);
    // What a screen reader hears contains what is on screen, so a voice-control user can say it.
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Bottom left', 'Bottom center', 'Bottom right']);
  });

  it('shows none of the spots as pressed when the embed put the launcher somewhere else', () => {
    const { host } = setup([highlightLinks, pauseAnimations], [], { position: 'top-right' });
    expect(host.shadowRoot!.querySelectorAll('[data-pulxon-position][aria-pressed="true"]').length).toBe(0);
  });

  it("shows the launcher's current corner as pressed before the visitor makes any choice", () => {
    // No stored `settings.ui.position` yet — the launcher still sits wherever the embed's own
    // `data-position` (here, "bottom-right") put it, so the picker must read that spot as pressed
    // too, not leave every button unpressed while the launcher plainly sits at one of them.
    const { host } = setup([highlightLinks, pauseAnimations], [], { position: 'bottom-right' });
    const pressed = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="bottom-right"]')!;
    expect(pressed.getAttribute('aria-pressed')).toBe('true');
    const other = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="bottom-left"]')!;
    expect(other.getAttribute('aria-pressed')).toBe('false');
  });

  it('still writes an explicit position on click even when the embed default was already showing as pressed', async () => {
    const { host, store } = setup([highlightLinks, pauseAnimations], [], { position: 'bottom-right' });
    expect(store.get().ui.position).toBeNull();
    const spot = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="bottom-right"]')!;
    await act(async () => spot.click());
    expect(store.get().ui.position).toBe('bottom-right');
  });

  it('re-renders the panel in the selected language, and reverts on auto', async () => {
    const { host } = setup();
    const title = () => host.shadowRoot!.querySelector('#pulxon-title')!.textContent;
    expect(title()).toBe('Accessibility');

    const select = host.shadowRoot!.querySelector<HTMLSelectElement>('[data-pulxon-lang-picker]')!;
    await act(async () => {
      select.value = 'es';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // Spanish is a file fetched on first use; the panel switches once it has arrived.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(title()).toBe('Accesibilidad');

    await act(async () => {
      select.value = 'auto';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(title()).toBe('Accessibility');
  });

  it('falls back to "auto" in the picker when the stored language is outside the shipped set', () => {
    // A `settings.lang` this widget has no matching <option> for — from a newer widget version, or
    // a hand-edited/stale value — must not leave the native <select> with no option selected
    // (blank). Pre-seed storage directly since parseSettings stores `lang` as-is, unvalidated.
    const storage = createMemoryStorage();
    storage.set(
      'pulxon:settings',
      JSON.stringify({ v: 1, features: {}, profile: null, lang: 'xx', ui: { scale: 'normal', position: null } }),
    );
    const { host, store } = setup([highlightLinks, pauseAnimations], [], {}, storage);
    expect(store.get().lang).toBe('xx');
    const select = host.shadowRoot!.querySelector<HTMLSelectElement>('[data-pulxon-lang-picker]')!;
    expect(select.value).toBe('auto');
  });

  it('names every control for a screen reader', () => {
    const { host } = setup();
    for (const selector of ['[data-pulxon-lang-picker]', '[data-pulxon-scale="large"]', '[data-pulxon-position="bottom-left"]']) {
      const element = host.shadowRoot!.querySelector(selector)!;
      const name = element.getAttribute('aria-label') ?? element.getAttribute('aria-labelledby');
      expect(name, selector).toBeTruthy();
    }
  });
});
