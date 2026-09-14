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

  it('scales text placed directly inside containers and restores it', () => {
    mockFontSizes();
    document.body.innerHTML = '<div id="d" data-px="10">Text</div><section id="s" data-px="11">Section text</section>';
    const ctx = makeCtx();
    biggerText.apply(ctx, 1);
    expect(el('d').style.getPropertyValue('font-size')).toBe('12px');
    expect(el('s').style.getPropertyValue('font-size')).toBe('13.2px');
    biggerText.teardown(ctx);
    expect(el('d').style.getPropertyValue('font-size')).toBe('');
    expect(el('s').style.getPropertyValue('font-size')).toBe('');
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

  it('scales several elements added in the same tick with one read pass before writing', async () => {
    const calls: string[] = [];
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node: Element) => {
      calls.push('read');
      return { fontSize: `${(node as HTMLElement).dataset.px ?? '16'}px` } as CSSStyleDeclaration;
    });
    document.body.innerHTML = '<main id="m"></main>';
    const ctx = makeCtx();
    biggerText.apply(ctx, 1);
    const first = document.createElement('p');
    first.dataset.px = '10';
    const second = document.createElement('p');
    second.dataset.px = '20';
    const setProperty = CSSStyleDeclaration.prototype.setProperty;
    vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty').mockImplementation(function (this: CSSStyleDeclaration, ...args) {
      calls.push('write');
      setProperty.apply(this, args);
    });
    calls.length = 0;
    el('m').appendChild(first);
    el('m').appendChild(second);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(first.style.getPropertyValue('font-size')).toBe('12px');
    expect(second.style.getPropertyValue('font-size')).toBe('24px');
    // Two reads, then only writes (scaled ancestors are re-applied after the read pass).
    expect(calls.slice(0, 2)).toEqual(['read', 'read']);
    expect(calls.slice(2).length).toBeGreaterThanOrEqual(2);
    expect(calls.slice(2).every((call) => call === 'write')).toBe(true);
  });

  it('measures late inheriting content against the original size of scaled ancestors', async () => {
    // Minimal inheritance model: an element without data-px inherits its parent's inline px size, else its data-px.
    const sizeOf = (node: Element | null): string => {
      if (!node || node === document.documentElement) return '16px';
      const own = (node as HTMLElement).dataset.px;
      if (own) return `${own}px`;
      const parent = node.parentElement as HTMLElement | null;
      return parent?.style.getPropertyValue('font-size') || sizeOf(parent);
    };
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node: Element) => ({ fontSize: sizeOf(node) }) as CSSStyleDeclaration);
    document.body.innerHTML = '<main id="m" data-px="10"><p id="p">Existing</p></main>';
    const ctx = makeCtx();
    biggerText.apply(ctx, 1);
    expect(el('m').style.getPropertyValue('font-size')).toBe('12px');
    expect(el('p').style.getPropertyValue('font-size')).toBe('12px');

    const late = document.createElement('p');
    el('m').appendChild(late);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(late.style.getPropertyValue('font-size')).toBe('12px');
    expect(el('m').style.getPropertyValue('font-size')).toBe('12px');
    expect(el('m').style.getPropertyPriority('font-size')).toBe('important');
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
