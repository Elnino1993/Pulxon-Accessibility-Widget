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
import { mountUI, type UiHandle } from './mount';

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
  it('offers the languages the widget ships', async () => {
    const { host } = setup();
    const select = host.shadowRoot!.querySelector<HTMLSelectElement>('[data-pulxon-lang-picker]')!;
    expect([...select.options].map((option) => option.value)).toEqual(['auto', 'en', 'es']);
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
    const corner = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="top-right"]')!;
    await act(async () => corner.click());
    expect(store.get().ui.position).toBe('top-right');
  });

  it("shows the launcher's current corner as pressed before the visitor makes any choice", () => {
    // No stored `settings.ui.position` yet — the launcher still sits wherever the embed's own
    // `data-position` (here, "top-left") put it, so the grid must read that corner as pressed too,
    // not leave all eight buttons unpressed while the launcher plainly sits in one of them.
    const { host } = setup([highlightLinks, pauseAnimations], [], { position: 'top-left' });
    const pressed = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="top-left"]')!;
    expect(pressed.getAttribute('aria-pressed')).toBe('true');
    const other = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="bottom-right"]')!;
    expect(other.getAttribute('aria-pressed')).toBe('false');
  });

  it('still writes an explicit position on click even when the embed default was already showing as pressed', async () => {
    const { host, store } = setup([highlightLinks, pauseAnimations], [], { position: 'top-left' });
    expect(store.get().ui.position).toBeNull();
    const corner = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="top-left"]')!;
    await act(async () => corner.click());
    expect(store.get().ui.position).toBe('top-left');
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
      JSON.stringify({ v: 1, features: {}, profile: null, lang: 'fr', ui: { scale: 'normal', position: null } }),
    );
    const { host, store } = setup([highlightLinks, pauseAnimations], [], {}, storage);
    expect(store.get().lang).toBe('fr');
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
