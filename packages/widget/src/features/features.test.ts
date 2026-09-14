import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { HIGHLIGHT_LINKS_CSS, highlightLinks } from './highlight-links';
import { builtinFeatures } from './index';
import { PAUSE_ANIMATIONS_CSS, pauseAnimations } from './pause-animations';

function makeCtx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

function styleText(id: string): string | null | undefined {
  return document.head.querySelector(`style[data-pulxon-style="${id}"]`)?.textContent;
}

function video(id: string): HTMLVideoElement {
  return document.getElementById(id) as HTMLVideoElement;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('highlightLinks', () => {
  it('injects and removes its stylesheet', () => {
    const ctx = makeCtx();
    highlightLinks.apply(ctx, 1);
    expect(styleText('highlight-links')).toBe(HIGHLIGHT_LINKS_CSS);
    expect(HIGHLIGHT_LINKS_CSS).toContain(':not([data-pulxon-ignore] *)');
    highlightLinks.teardown(ctx);
    expect(styleText('highlight-links')).toBeUndefined();
  });
});

describe('pauseAnimations', () => {
  it('injects CSS, pauses playing videos outside ignored areas and resumes them', () => {
    document.body.innerHTML =
      '<video id="a"></video><video id="b"></video><div data-pulxon-ignore><video id="c"></video></div>';
    const a = video('a');
    const b = video('b');
    const c = video('c');
    Object.defineProperty(a, 'paused', { value: false, configurable: true });
    Object.defineProperty(c, 'paused', { value: false, configurable: true });
    const pauseA = vi.spyOn(a, 'pause').mockImplementation(() => undefined);
    const pauseB = vi.spyOn(b, 'pause').mockImplementation(() => undefined);
    const pauseC = vi.spyOn(c, 'pause').mockImplementation(() => undefined);
    const playA = vi.spyOn(a, 'play').mockResolvedValue(undefined);

    const ctx = makeCtx();
    pauseAnimations.apply(ctx, 1);
    expect(styleText('pause-animations')).toBe(PAUSE_ANIMATIONS_CSS);
    expect(pauseA).toHaveBeenCalledOnce();
    expect(pauseB).not.toHaveBeenCalled();
    expect(pauseC).not.toHaveBeenCalled();
    expect(a.hasAttribute('data-pulxon-paused')).toBe(true);

    pauseAnimations.teardown(ctx);
    expect(styleText('pause-animations')).toBeUndefined();
    expect(playA).toHaveBeenCalledOnce();
    expect(a.hasAttribute('data-pulxon-paused')).toBe(false);
  });
});

describe('builtinFeatures', () => {
  it('exposes the reference features with stable ids', () => {
    expect(builtinFeatures.map((f) => f.id)).toEqual([
      'bigger-text',
      'text-spacing',
      'line-height',
      'text-align',
      'dyslexia-font',
      'bold-text',
      'contrast',
      'saturation',
      'highlight-links',
      'pause-animations',
      'hide-images',
    ]);
  });
});
