import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveOptions, type WidgetOptions } from '../config/options';
import { createController } from '../core/controller';
import { createRegistry } from '../core/registry';
import { createMemoryStorage } from '../core/storage';
import { createSettingsStore } from '../core/store';
import { createStyleEngine } from '../core/style-engine';
import { builtinFeatures } from '../features';
import { createTranslator } from '../i18n';
import { mountUI, type UiHandle } from './mount';

const handles: UiHandle[] = [];

function setup(opts: Partial<WidgetOptions> = {}) {
  const store = createSettingsStore(createMemoryStorage());
  const registry = createRegistry(builtinFeatures);
  const styles = createStyleEngine(document, { mode: 'style-tag' });
  const controller = createController({ registry, store, ctx: { doc: document, styles }, profiles: [] });
  const holder: { ui?: UiHandle } = {};
  act(() => {
    holder.ui = mountUI({
      doc: document,
      options: resolveOptions(opts),
      controller,
      registry,
      store,
      profiles: [],
      t: createTranslator('en'),
      styleMode: 'style-tag',
    });
  });
  const ui = holder.ui;
  if (!ui) throw new Error('mount failed');
  handles.push(ui);
  const root = ui.host.shadowRoot;
  if (!root) throw new Error('missing shadow root');
  const launcher = () => root.querySelector<HTMLButtonElement>('button.launcher');
  return { ui, root, controller, store, launcher };
}

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.innerHTML = '';
});

describe('mountUI', () => {
  it('mounts an isolated launcher inside a shadow root', () => {
    const { ui, root, launcher } = setup({ position: 'top-left', size: 'large' });
    expect(ui.host.id).toBe('pulxon-root');
    expect(ui.host.hasAttribute('data-pulxon-ignore')).toBe(true);
    expect(root.querySelector('style[data-pulxon-style="ui"]')).not.toBeNull();
    const button = launcher();
    expect(button?.getAttribute('aria-label')).toBe('Open accessibility menu');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.hasAttribute('aria-controls')).toBe(false);
    expect(button?.classList.contains('launcher--top-left')).toBe(true);
    expect(button?.classList.contains('launcher--large')).toBe(true);
  });

  it('marks the host for hiding on mobile when requested', () => {
    const { ui } = setup({ hideOnMobile: true });
    expect(ui.host.hasAttribute('data-hide-mobile')).toBe(true);
  });

  it('reflects open state through the handle', () => {
    const { ui, launcher } = setup();
    act(() => ui.open());
    expect(ui.isOpen()).toBe(true);
    expect(launcher()?.getAttribute('aria-expanded')).toBe('true');
    expect(launcher()?.getAttribute('aria-controls')).toBe('pulxon-panel');
    act(() => ui.close());
    expect(launcher()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles when the launcher is clicked', () => {
    const { ui, launcher } = setup();
    act(() => launcher()?.click());
    expect(ui.isOpen()).toBe(true);
    act(() => launcher()?.click());
    expect(ui.isOpen()).toBe(false);
  });

  it('toggles with the Alt+A hotkey', () => {
    const { ui } = setup();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyA', key: 'a', bubbles: true }));
    });
    expect(ui.isOpen()).toBe(true);
  });

  it('opens from a custom trigger and ignores invalid selectors', () => {
    document.body.innerHTML = '<button id="my-trigger" type="button">A11y</button>';
    const { ui } = setup({ trigger: '#my-trigger' });
    act(() => document.getElementById('my-trigger')?.click());
    expect(ui.isOpen()).toBe(true);
    expect(() => setup({ trigger: '[[invalid' })).not.toThrow();
  });

  it('destroy removes the host and stops listening to the hotkey', () => {
    const { ui } = setup();
    ui.destroy();
    expect(document.getElementById('pulxon-root')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyA', key: 'a', bubbles: true }));
    expect(ui.isOpen()).toBe(false);
  });
});
