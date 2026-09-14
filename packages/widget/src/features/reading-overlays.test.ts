import { afterEach, describe, expect, it } from 'vitest';
import { createRegistry } from '../core/registry';
import { createStyleEngine } from '../core/style-engine';
import { MASK_BAND_PX, readingGuide, readingMask } from './reading-overlays';

function makeCtx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

function styleText(id: string): string | null {
  return document.head.querySelector(`style[data-pulxon-style="${id}"]`)?.textContent ?? null;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function movePointer(clientY: number): void {
  document.dispatchEvent(new MouseEvent('pointermove', { clientY, bubbles: true }));
}

afterEach(() => {
  const ctx = makeCtx();
  readingMask.teardown(ctx);
  readingGuide.teardown(ctx);
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('readingMask', () => {
  it('creates two ignored overlays that follow the pointer', async () => {
    const ctx = makeCtx();
    readingMask.apply(ctx, 1);
    const parts = Array.from(document.querySelectorAll<HTMLElement>('.pulxon-reading-mask'));
    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part.hasAttribute('data-pulxon-ignore')).toBe(true);
      expect(part.getAttribute('aria-hidden')).toBe('true');
    }
    expect(styleText('reading-mask')).toContain('pointer-events:none!important');

    movePointer(300);
    await nextFrame();
    expect(MASK_BAND_PX).toBe(120);
    expect(parts[0]?.style.getPropertyValue('height')).toBe('240px');
    expect(parts[1]?.style.getPropertyValue('top')).toBe('360px');
  });

  it('is idempotent and fully removed on teardown', () => {
    const ctx = makeCtx();
    readingMask.apply(ctx, 1);
    readingMask.apply(ctx, 1);
    expect(document.querySelectorAll('.pulxon-reading-mask')).toHaveLength(2);
    readingMask.teardown(ctx);
    expect(document.querySelectorAll('.pulxon-reading-mask')).toHaveLength(0);
    expect(styleText('reading-mask')).toBeNull();
  });

  it('stops following the pointer after teardown', async () => {
    const ctx = makeCtx();
    readingMask.apply(ctx, 1);
    const top = document.querySelector<HTMLElement>('.pulxon-reading-mask--top');
    readingMask.teardown(ctx);
    movePointer(100);
    await nextFrame();
    expect(top?.isConnected).toBe(false);
  });
});

describe('readingGuide', () => {
  it('draws a bar below the pointer and follows keyboard focus', async () => {
    document.body.innerHTML = '<button id="b" type="button">Go</button>';
    const ctx = makeCtx();
    readingGuide.apply(ctx, 1);
    const bar = document.querySelector<HTMLElement>('.pulxon-reading-guide');
    movePointer(100);
    await nextFrame();
    expect(bar?.style.getPropertyValue('top')).toBe('114px');
    (document.getElementById('b') as HTMLButtonElement).focus();
    await nextFrame();
    expect(bar?.style.getPropertyValue('top')).toBe('14px');
  });

  it('conflicts with the reading mask in both directions', () => {
    const registry = createRegistry([readingMask, readingGuide]);
    expect(registry.conflicts('reading-mask')).toEqual(['reading-guide']);
    expect(registry.conflicts('reading-guide')).toEqual(['reading-mask']);
  });
});
