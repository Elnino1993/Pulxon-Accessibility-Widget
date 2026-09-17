import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { dictionary, lookupUrl } from './dictionary';

function ctx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

function select(text: string) {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  document.body.append(paragraph);
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

afterEach(() => {
  // Unconditional, so a failed assertion mid-test can't leave the module-level
  // CLEANUPS WeakMap pointing at a stale listener set for later tests (mirrors
  // the pattern in tooltips.test.ts / reading-overlays.test.ts).
  dictionary.teardown(ctx());
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('lookupUrl', () => {
  it('points at the Wiktionary entry for the word', () => {
    expect(lookupUrl('bicycle', 'en')).toBe('https://en.wiktionary.org/wiki/bicycle');
  });

  it('encodes the word and drops surrounding punctuation', () => {
    expect(lookupUrl('  "caffè".  ', 'en')).toBe('https://en.wiktionary.org/wiki/caff%C3%A8');
  });

  it('uses the widget language for the wiki subdomain, falling back to English', () => {
    expect(lookupUrl('bici', 'es')).toBe('https://es.wiktionary.org/wiki/bici');
    expect(lookupUrl('bici', 'zz-not-a-lang')).toBe('https://en.wiktionary.org/wiki/bici');
  });

  it('returns null when the selection is not a single word', () => {
    expect(lookupUrl('a whole sentence here', 'en')).toBeNull();
    expect(lookupUrl('   ', 'en')).toBeNull();
  });

  it('requires at least one letter, rejecting a "word" of pure punctuation or marks', () => {
    expect(lookupUrl('--', 'en')).toBeNull();
    expect(lookupUrl("'", 'en')).toBeNull();
    // Combining marks alone (no base letter) survive the surrounding-punctuation strip untouched
    // (they're `\p{M}`, not stripped by `[^\p{L}\p{M}]`) and, without the letter requirement, the
    // old `WORD` regex accepted them outright — a real, reachable case of "pure punctuation" (no
    // visible letter) producing a lookup URL.
    expect(lookupUrl('́́', 'en')).toBeNull();
  });
});

describe('dictionary', () => {
  it('offers a lookup button once a word is selected', () => {
    const context = ctx();
    dictionary.apply(context, 1);
    select('bicycle');

    const button = document.querySelector<HTMLAnchorElement>('[data-pulxon-dictionary]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('href')).toBe('https://en.wiktionary.org/wiki/bicycle');
    expect(button?.getAttribute('target')).toBe('_blank');
    expect(button?.getAttribute('rel')).toBe('noopener noreferrer');
    dictionary.teardown(context);
  });

  it('makes no request of its own', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const context = ctx();
    dictionary.apply(context, 1);
    select('bicycle');
    expect(fetchSpy).not.toHaveBeenCalled();
    dictionary.teardown(context);
    fetchSpy.mockRestore();
  });

  it('removes the button on teardown', () => {
    const context = ctx();
    dictionary.apply(context, 1);
    select('bicycle');
    dictionary.teardown(context);
    expect(document.querySelector('[data-pulxon-dictionary]')).toBeNull();
  });

  it('ignores a selection made inside the widget’s own (open) shadow-root panel', () => {
    // `closestAcrossShadow` is what stops the feature from firing here: a plain `closest()` call
    // on `selection.anchorNode` can't walk out past the shadow boundary to see the ignored host,
    // since (per the shadow-root findings) an open shadow root does not retarget the Selection API
    // the way DOM events are retargeted.
    const host = document.createElement('div');
    host.setAttribute('data-pulxon-ignore', '');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const paragraph = document.createElement('p');
    paragraph.textContent = 'bicycle';
    shadow.append(paragraph);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const context = ctx();
    dictionary.apply(context, 1);
    document.dispatchEvent(new Event('selectionchange'));

    expect(document.querySelector('[data-pulxon-dictionary]')).toBeNull();
  });

  it('keeps the dictionary link inside the viewport when the selection sits at the far right edge', () => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'bicycle';
    document.body.append(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const context = ctx();
    dictionary.apply(context, 1);
    document.dispatchEvent(new Event('selectionchange'));

    // First show creates the link element so we can then stub its own measured size, matching how
    // tooltips.test.ts stubs the tooltip's own rect.
    const link = document.querySelector<HTMLAnchorElement>('[data-pulxon-dictionary]');
    expect(link).not.toBeNull();
    link!.getBoundingClientRect = () =>
      ({ width: 200, height: 30, left: 0, top: 0, right: 200, bottom: 30, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    range.getBoundingClientRect = () =>
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

    document.dispatchEvent(new Event('selectionchange'));

    const left = Number.parseFloat(link!.style.getPropertyValue('left'));
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + 200).toBeLessThanOrEqual(window.innerWidth);
  });

  it('keeps the dictionary link inside the viewport when the selection sits at the bottom edge', () => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'bicycle';
    document.body.append(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const context = ctx();
    dictionary.apply(context, 1);
    document.dispatchEvent(new Event('selectionchange'));

    const link = document.querySelector<HTMLAnchorElement>('[data-pulxon-dictionary]');
    expect(link).not.toBeNull();
    link!.getBoundingClientRect = () =>
      ({ width: 100, height: 30, left: 0, top: 0, right: 100, bottom: 30, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    const bottom = window.innerHeight - 5;
    range.getBoundingClientRect = () =>
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

    document.dispatchEvent(new Event('selectionchange'));

    const top = Number.parseFloat(link!.style.getPropertyValue('top'));
    expect(top).toBeLessThan(bottom - 20);
    expect(top + 30).toBeLessThanOrEqual(bottom - 20);
  });
});
