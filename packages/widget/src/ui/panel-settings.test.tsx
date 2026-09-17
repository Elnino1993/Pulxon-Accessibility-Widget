import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveOptions } from '../config/options';
import { createController } from '../core/controller';
import { createRegistry, type FeatureDefinition, type ProfileDefinition } from '../core/registry';
import { createMemoryStorage } from '../core/storage';
import { createSettingsStore } from '../core/store';
import { createStyleEngine } from '../core/style-engine';
import { highlightLinks, pauseAnimations } from '../features';
import { createTranslator } from '../i18n';
import { mountUI, type UiHandle } from './mount';

const handles: UiHandle[] = [];

function setup(features: FeatureDefinition[] = [highlightLinks, pauseAnimations], profiles: ProfileDefinition[] = []) {
  const store = createSettingsStore(createMemoryStorage());
  const registry = createRegistry(features);
  const styles = createStyleEngine(document, { mode: 'style-tag' });
  const controller = createController({ registry, store, ctx: { doc: document, styles }, profiles });
  const holder: { ui?: UiHandle } = {};
  act(() => {
    holder.ui = mountUI({
      doc: document,
      options: resolveOptions({}),
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
    const corner = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="bottom-left"]')!;
    await act(async () => corner.click());
    expect(store.get().ui.position).toBe('bottom-left');
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
