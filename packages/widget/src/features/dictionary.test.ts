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
});
