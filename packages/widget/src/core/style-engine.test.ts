import { describe, expect, it } from 'vitest';
import { createStyleEngine } from './style-engine';

describe('createStyleEngine (style-tag mode)', () => {
  it('adds, updates and removes a style tag with nonce in document head', () => {
    const engine = createStyleEngine(document, { mode: 'style-tag', nonce: 'abc' });
    engine.set('x', 'a{color:red}');
    const el = document.head.querySelector<HTMLStyleElement>('style[data-pulxon-style="x"]');
    expect(el?.textContent).toBe('a{color:red}');
    expect(el?.nonce).toBe('abc');
    expect(engine.has('x')).toBe(true);

    engine.set('x', 'a{color:blue}');
    expect(document.head.querySelectorAll('style[data-pulxon-style="x"]')).toHaveLength(1);
    expect(el?.textContent).toBe('a{color:blue}');

    engine.remove('x');
    expect(document.head.querySelector('style[data-pulxon-style="x"]')).toBeNull();
    expect(engine.has('x')).toBe(false);
  });

  it('appends into a shadow root and clears everything', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const engine = createStyleEngine(root, { mode: 'style-tag' });
    engine.set('ui', ':host{all:initial}');
    engine.set('extra', 'p{margin:0}');
    expect(root.querySelectorAll('style')).toHaveLength(2);
    engine.clear();
    expect(root.querySelectorAll('style')).toHaveLength(0);
  });

  it('remove of an unknown id is a no-op', () => {
    const engine = createStyleEngine(document, { mode: 'style-tag' });
    expect(() => engine.remove('missing')).not.toThrow();
  });
});
