import { afterEach, describe, expect, it } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { tooltips } from './tooltips';

function ctx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

afterEach(() => {
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
});
