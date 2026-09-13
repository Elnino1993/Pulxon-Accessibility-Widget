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

function setup(opts: Partial<WidgetOptions> = {}, lang?: string) {
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
      lang,
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

  it('exposes accent color and z-index on the element shared by launcher and panel', () => {
    const { ui, root, launcher } = setup({ color: '#ff0000', zIndex: 5 });
    act(() => ui.open());
    const panel = root.querySelector('.panel');
    const mountPoint = launcher()?.parentElement;
    expect(panel?.parentElement).toBe(mountPoint);
    expect(mountPoint?.style.getPropertyValue('--pulxon-accent')).toBe('#ff0000');
    expect(mountPoint?.style.getPropertyValue('--pulxon-z')).toBe('5');
    expect(launcher()?.style.getPropertyValue('--pulxon-accent')).toBe('');
  });

  it('exposes a readable foreground color for the accent', () => {
    expect(setup({ color: '#ffd400' }).launcher()?.parentElement?.style.getPropertyValue('--pulxon-on-accent')).toBe(
      '#000000',
    );
    expect(setup({ color: '#1f4bff' }).launcher()?.parentElement?.style.getPropertyValue('--pulxon-on-accent')).toBe(
      '#ffffff',
    );
  });

  it('marks the widget language and direction on the mount point', () => {
    const mountPoint = setup({}, 'es').launcher()?.parentElement;
    expect(mountPoint?.getAttribute('lang')).toBe('es');
    expect(mountPoint?.getAttribute('dir')).toBe('ltr');
    expect(setup().launcher()?.parentElement?.getAttribute('lang')).toBe('en');
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

  it('ignores Alt+A while typing in an editable field', () => {
    document.body.innerHTML = '<input id="field" type="text"><textarea id="area"></textarea>';
    const { ui } = setup();
    for (const id of ['field', 'area']) {
      const field = document.getElementById(id) as HTMLElement;
      field.focus();
      const event = new KeyboardEvent('keydown', { altKey: true, code: 'KeyA', key: 'a', bubbles: true, cancelable: true });
      act(() => {
        field.dispatchEvent(event);
      });
      expect(ui.isOpen()).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    }
  });

  it('ignores auto-repeated and already handled Alt+A events', () => {
    const { ui } = setup();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyA', key: 'a', bubbles: true }));
    });
    expect(ui.isOpen()).toBe(true);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { altKey: true, code: 'KeyA', key: 'a', bubbles: true, repeat: true }),
      );
    });
    expect(ui.isOpen()).toBe(true);
    const handled = new KeyboardEvent('keydown', { altKey: true, code: 'KeyA', key: 'a', bubbles: true, cancelable: true });
    handled.preventDefault();
    act(() => {
      document.dispatchEvent(handled);
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
