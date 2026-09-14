import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { TEXT_SCALES, biggerText } from './bigger-text';

function makeCtx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

/** happy-dom does not compute font sizes, so tests declare them with data-px. */
function mockFontSizes() {
  return vi
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((node: Element) => ({ fontSize: `${(node as HTMLElement).dataset.px ?? '16'}px` }) as CSSStyleDeclaration);
}

afterEach(() => {
  biggerText.teardown(makeCtx());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('biggerText', () => {
  it('has four levels', () => {
    expect(biggerText.levels).toBe(4);
    expect(TEXT_SCALES).toEqual([1.2, 1.4, 1.6, 1.8]);
  });

  it('scales text from its computed size, rescales on level change and restores inline styles', () => {
    mockFontSizes();
    document.body.innerHTML =
      '<p id="p" data-px="10">Text</p>' +
      '<h1 id="h" data-px="20" style="font-size: 2em">Title</h1>' +
      '<div data-pulxon-ignore><p id="ignored" data-px="10">Widget</p></div>';
    const ctx = makeCtx();

    biggerText.apply(ctx, 1);
    expect(el('p').style.getPropertyValue('font-size')).toBe('12px');
    expect(el('p').style.getPropertyPriority('font-size')).toBe('important');
    expect(el('h').style.getPropertyValue('font-size')).toBe('24px');
    expect(el('ignored').style.getPropertyValue('font-size')).toBe('');

    biggerText.apply(ctx, 4);
    expect(el('p').style.getPropertyValue('font-size')).toBe('18px');

    biggerText.teardown(ctx);
    expect(el('p').style.getPropertyValue('font-size')).toBe('');
    expect(el('h').style.getPropertyValue('font-size')).toBe('2em');
    expect(el('h').style.getPropertyPriority('font-size')).toBe('');
  });

  it('scales elements added while active', async () => {
    mockFontSizes();
    document.body.innerHTML = '<main id="m"></main>';
    const ctx = makeCtx();
    biggerText.apply(ctx, 2);
    const added = document.createElement('p');
    added.dataset.px = '10';
    el('m').appendChild(added);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(added.style.getPropertyValue('font-size')).toBe('14px');
  });

  it('stops observing after teardown', async () => {
    mockFontSizes();
    document.body.innerHTML = '<main id="m"></main>';
    const ctx = makeCtx();
    biggerText.apply(ctx, 1);
    biggerText.teardown(ctx);
    const added = document.createElement('p');
    added.dataset.px = '10';
    el('m').appendChild(added);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(added.style.getPropertyValue('font-size')).toBe('');
  });

  it('restores and forgets elements removed from the page, and rescales them once if re-added', async () => {
    mockFontSizes();
    document.body.innerHTML = '<main id="m"><section id="s"><p id="child" data-px="10">Child</p></section></main>';
    const ctx = makeCtx();
    biggerText.apply(ctx, 2);
    const section = el('s');
    const child = el('child');
    expect(child.style.getPropertyValue('font-size')).toBe('14px');

    section.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(child.style.getPropertyValue('font-size')).toBe('');

    el('m').appendChild(section);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(child.style.getPropertyValue('font-size')).toBe('14px');
  });
});
