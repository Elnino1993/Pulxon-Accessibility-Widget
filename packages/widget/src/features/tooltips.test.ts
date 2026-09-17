import { afterEach, describe, expect, it } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { tooltips } from './tooltips';

function ctx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

afterEach(() => {
  // Unconditional, so a failed assertion mid-test can't leave the module-level
  // CLEANUPS WeakMap pointing at a stale listener set for later tests (mirrors
  // the pattern in reading-overlays.test.ts).
  tooltips.teardown(ctx());
  document.body.innerHTML = '';
});

describe('tooltips', () => {
  it('shows an element’s accessible name on focus', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Add to cart');
    document.body.append(button);
    const context = ctx();
    tooltips.apply(context, 1);

    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const tip = document.querySelector('[data-pulxon-tooltip]');
    expect(tip?.textContent).toBe('Add to cart');
    tooltips.teardown(context);
  });

  it('prefers the title, then aria-label, then the alt text', () => {
    const image = document.createElement('img');
    image.alt = 'A red bicycle';
    document.body.append(image);
    const context = ctx();
    tooltips.apply(context, 1);

    image.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')?.textContent).toBe('A red bicycle');

    image.title = 'Bicycle, 2024 model';
    image.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')?.textContent).toBe('Bicycle, 2024 model');
    tooltips.teardown(context);
  });

  it('shows nothing for an element without a name', () => {
    const div = document.createElement('div');
    document.body.append(div);
    const context = ctx();
    tooltips.apply(context, 1);

    div.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();
    tooltips.teardown(context);
  });

  it('removes the tooltip and its listeners on teardown', () => {
    const button = document.createElement('button');
    button.title = 'Save';
    document.body.append(button);
    const context = ctx();
    tooltips.apply(context, 1);
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).not.toBeNull();

    tooltips.teardown(context);
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();
  });

  it('is idempotent: applying twice does not double-register listeners or leave a second tooltip', () => {
    const button = document.createElement('button');
    button.title = 'Save';
    document.body.append(button);
    const context = ctx();
    tooltips.apply(context, 1);
    tooltips.apply(context, 1);

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelectorAll('[data-pulxon-tooltip]')).toHaveLength(1);

    button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();

    tooltips.teardown(context);
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();
  });

  it('stays on screen when the pointer moves from the target onto the tooltip bubble (WCAG 1.4.13 hoverable)', () => {
    const button = document.createElement('button');
    button.title = 'Save';
    document.body.append(button);
    const context = ctx();
    tooltips.apply(context, 1);

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const tip = document.querySelector<HTMLElement>('[data-pulxon-tooltip]');
    expect(tip).not.toBeNull();

    // The pointer crosses the gap from the button onto the tooltip bubble itself.
    button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: tip }));
    expect(document.querySelector('[data-pulxon-tooltip]')).not.toBeNull();

    // Entering the bubble fires its own mouseover too; it must not hide it or re-trigger a lookup.
    tip!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: button }));
    expect(document.querySelector('[data-pulxon-tooltip]')).not.toBeNull();

    // Moving back from the bubble onto the button (the reverse crossing) must not hide it either.
    tip!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: button }));
    expect(document.querySelector('[data-pulxon-tooltip]')).not.toBeNull();

    // Only leaving both the target and the bubble for good hides it.
    tip!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();
    tooltips.teardown(context);
  });

  it('ignores the widget’s own panel', () => {
    document.body.innerHTML =
      '<div data-pulxon-ignore><button id="inside" title="Widget control" type="button">Widget</button></div>';
    const context = ctx();
    tooltips.apply(context, 1);

    document.getElementById('inside')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();
    tooltips.teardown(context);
  });

  it('keeps the tooltip inside the viewport when the element sits at the far right edge', () => {
    const button = document.createElement('button');
    button.title = 'Save';
    document.body.append(button);
    const context = ctx();
    tooltips.apply(context, 1);

    // First show creates the tooltip element so we can then stub its own measured size,
    // matching how `reading-overlays.test.ts` stubs a target element's rect.
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const tip = document.querySelector<HTMLElement>('[data-pulxon-tooltip]');
    expect(tip).not.toBeNull();
    tip!.getBoundingClientRect = () =>
      ({ width: 280, height: 40, left: 0, top: 0, right: 280, bottom: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    button.getBoundingClientRect = () =>
      ({
        left: window.innerWidth - 20,
        right: window.innerWidth,
        top: 100,
        bottom: 120,
        width: 20,
        height: 20,
        x: window.innerWidth - 20,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const left = Number.parseFloat(tip!.style.getPropertyValue('left'));
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + 280).toBeLessThanOrEqual(window.innerWidth);
    tooltips.teardown(context);
  });

  it('flips the tooltip above the element when there is no room below', () => {
    const button = document.createElement('button');
    button.title = 'Save';
    document.body.append(button);
    const context = ctx();
    tooltips.apply(context, 1);

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const tip = document.querySelector<HTMLElement>('[data-pulxon-tooltip]');
    expect(tip).not.toBeNull();
    tip!.getBoundingClientRect = () =>
      ({ width: 100, height: 40, left: 0, top: 0, right: 100, bottom: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    const bottom = window.innerHeight - 5;
    button.getBoundingClientRect = () =>
      ({
        left: 10,
        right: 30,
        top: bottom - 20,
        bottom,
        width: 20,
        height: 20,
        x: 10,
        y: bottom - 20,
        toJSON: () => ({}),
      }) as DOMRect;

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const top = Number.parseFloat(tip!.style.getPropertyValue('top'));
    expect(top).toBeLessThan(bottom - 20);
    expect(top + 40).toBeLessThanOrEqual(bottom - 20);
    tooltips.teardown(context);
  });
});
