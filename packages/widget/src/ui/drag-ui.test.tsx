import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveOptions, type WidgetOptions } from '../config/options';
import { createController } from '../core/controller';
import { createRegistry } from '../core/registry';
import { createMemoryStorage, type KeyValueStorage } from '../core/storage';
import { createSettingsStore } from '../core/store';
import { createStyleEngine } from '../core/style-engine';
import { highlightLinks, pauseAnimations } from '../features';
import { createTranslator } from '../i18n';
import { EDGE, sizeOf, viewportOf } from './drag';
import { mountUI, type UiHandle } from './mount';

const handles: UiHandle[] = [];

function setup({ open = false, options = {}, storage = createMemoryStorage() }: { open?: boolean; options?: Partial<WidgetOptions>; storage?: KeyValueStorage } = {}) {
  const store = createSettingsStore(storage);
  const registry = createRegistry([highlightLinks, pauseAnimations]);
  const styles = createStyleEngine(document, { mode: 'style-tag' });
  const controller = createController({ registry, store, ctx: { doc: document, styles }, profiles: [] });
  const holder: { ui?: UiHandle } = {};
  act(() => {
    holder.ui = mountUI({
      doc: document,
      options: resolveOptions({}, options),
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
  if (open) act(() => ui.open());
  const launcher = () => root.querySelector<HTMLButtonElement>('.launcher')!;
  const panel = () => root.querySelector<HTMLElement>('#pulxon-panel');
  return { ui, root, store, launcher, panel };
}

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, button: 0, bubbles: true, composed: true });
}

/** Presses at (x0, y0), moves to (x1, y1) in two steps and releases, all on `element`. */
function drag(element: Element, x0: number, y0: number, x1: number, y1: number): void {
  act(() => {
    element.dispatchEvent(pointer('pointerdown', x0, y0));
  });
  act(() => {
    element.dispatchEvent(pointer('pointermove', (x0 + x1) / 2, (y0 + y1) / 2));
    element.dispatchEvent(pointer('pointermove', x1, y1));
  });
  act(() => {
    element.dispatchEvent(pointer('pointerup', x1, y1));
  });
}

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('dragging the launcher', () => {
  it('follows the pointer while it is held, lifted as high as the visitor likes', () => {
    const { launcher } = setup();
    act(() => {
      launcher().dispatchEvent(pointer('pointerdown', 20, 20));
    });
    act(() => {
      launcher().dispatchEvent(pointer('pointermove', 400, 300));
    });
    expect(launcher().classList.contains('launcher--dragging')).toBe(true);
    // It moves by the pointer's travel (380, 280) from where it started, which happy-dom, laying
    // nothing out, reports as 0,0.
    expect(launcher().style.left).toBe('380px');
    expect(launcher().style.top).toBe('280px');
    act(() => {
      launcher().dispatchEvent(pointer('pointerup', 400, 300));
    });
  });

  it('falls to the bottom edge when let go, keeping where it was across, and remembers it', () => {
    const { launcher, store } = setup();
    expect(launcher().classList.contains('launcher--bottom-left')).toBe(true);

    drag(launcher(), 20, 20, 400, 300);

    expect(launcher().classList.contains('launcher--free')).toBe(true);
    expect(launcher().classList.contains('launcher--bottom-left')).toBe(false);
    expect(launcher().style.left).toBe('380px');
    const bottom = viewportOf(launcher()).height - sizeOf(launcher()).height - EDGE;
    expect(launcher().style.top).toBe(`${bottom}px`);
    const spot = store.get().ui.launcher;
    expect(spot!.x).toBeGreaterThan(0);
    expect(spot!.y).toBe(1);
  });

  it('does not open the panel with the click that follows the drag', () => {
    const { launcher, panel } = setup();
    drag(launcher(), 20, 20, 400, 300);
    act(() => launcher().click());
    expect(panel()).toBeNull();
  });

  it('opens the panel on a real click made right after a drag', () => {
    const { launcher, panel } = setup();
    drag(launcher(), 20, 20, 400, 300);
    act(() => {
      launcher().dispatchEvent(pointer('pointerdown', 400, 300));
      launcher().dispatchEvent(pointer('pointerup', 400, 300));
      launcher().click();
    });
    expect(panel()).not.toBeNull();
  });

  it('still opens the panel on a plain press that does not move', () => {
    const { launcher, panel } = setup();
    act(() => {
      launcher().dispatchEvent(pointer('pointerdown', 30, 30));
      launcher().dispatchEvent(pointer('pointerup', 31, 30));
      launcher().click();
    });
    expect(panel()).not.toBeNull();
  });

  it('starts where it was dropped last time', () => {
    const storage = createMemoryStorage();
    storage.set('pulxon:settings', JSON.stringify({ v: 1, features: {}, profile: null, lang: null, ui: { scale: 'normal', position: null, launcher: { x: 0.5, y: 0.5 }, panel: null } }));
    const { launcher } = setup({ storage });
    expect(launcher().classList.contains('launcher--free')).toBe(true);
    expect(launcher().style.left).not.toBe('');
  });

  it('goes back to a fixed spot, and no spot reads as pressed until it does, when one is picked', () => {
    const { launcher, root, store, ui } = setup();
    drag(launcher(), 20, 20, 400, 300);
    act(() => ui.open());

    const pressed = root.querySelectorAll('[data-pulxon-position][aria-pressed="true"]');
    expect(pressed.length).toBe(0);

    act(() => root.querySelector<HTMLButtonElement>('[data-pulxon-position="bottom-right"]')!.click());
    expect(store.get().ui).toMatchObject({ position: 'bottom-right', launcher: null, panel: null });
    expect(launcher().classList.contains('launcher--bottom-right')).toBe(true);
    expect(launcher().classList.contains('launcher--free')).toBe(false);
  });
});

describe('dragging the panel', () => {
  it('moves it by its title bar and remembers where it was dropped', () => {
    const { root, panel, store } = setup({ open: true });
    const handle = root.querySelector('[data-pulxon-drag-handle]')!;
    const title = root.querySelector('#pulxon-title')!;

    // Pressed on the title text: the whole bar is the handle, not just its empty space.
    act(() => {
      title.dispatchEvent(pointer('pointerdown', 50, 20));
    });
    act(() => {
      handle.dispatchEvent(pointer('pointermove', 200, 120));
      handle.dispatchEvent(pointer('pointermove', 350, 220));
    });
    act(() => {
      handle.dispatchEvent(pointer('pointerup', 350, 220));
    });

    expect(panel()!.style.left).toBe('300px');
    expect(panel()!.style.top).toBe('200px');
    expect(store.get().ui.panel).not.toBeNull();
  });

  it('closes, and does not start a drag, from the close button in the title bar', () => {
    const { root, panel, store } = setup({ open: true });
    const close = root.querySelector<HTMLButtonElement>('.panel__header button')!;
    act(() => {
      close.dispatchEvent(pointer('pointerdown', 10, 10));
      close.dispatchEvent(pointer('pointermove', 300, 300));
      close.dispatchEvent(pointer('pointerup', 300, 300));
      close.click();
    });
    expect(panel()).toBeNull();
    expect(store.get().ui.panel).toBeNull();
  });

  it('scrolls its content in its own region, below a title bar that stays put', () => {
    const { root } = setup({ open: true });
    const body = root.querySelector('.panel__body');
    expect(body).not.toBeNull();
    // The close button is outside the scrolling region, so scrolling can never hide it.
    expect(body!.contains(root.querySelector('.panel__header button'))).toBe(false);
    expect(body!.querySelector('[data-pulxon-position]')).not.toBeNull();
  });
});
