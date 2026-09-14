import { afterEach, describe, expect, it } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { BIG_ARROW_CURSOR, BIG_HAND_CURSOR, bigCursor, focusHighlight, highlightHeadings } from './navigation-features';
import { NOT_IGNORED } from './shared';

function makeCtx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

function styleText(id: string): string | null {
  return document.head.querySelector(`style[data-pulxon-style="${id}"]`)?.textContent ?? null;
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('navigation features', () => {
  it('highlight-headings outlines headings including ARIA headings', () => {
    const ctx = makeCtx();
    highlightHeadings.apply(ctx, 1);
    expect(styleText('highlight-headings')).toContain(`h1${NOT_IGNORED}`);
    expect(styleText('highlight-headings')).toContain(`[role="heading"]${NOT_IGNORED}`);
    expect(styleText('highlight-headings')).toContain('outline:3px dashed #b00020!important');
    highlightHeadings.teardown(ctx);
    expect(styleText('highlight-headings')).toBeNull();
  });

  it('focus-highlight strengthens the keyboard focus ring', () => {
    const ctx = makeCtx();
    focusHighlight.apply(ctx, 1);
    expect(styleText('focus-highlight')).toContain(`:focus-visible${NOT_IGNORED}`);
    expect(styleText('focus-highlight')).toContain('outline:4px solid #1f4bff!important');
  });

  it('big-cursor uses encoded SVG cursors with safe fallbacks', () => {
    const ctx = makeCtx();
    bigCursor.apply(ctx, 1);
    expect(bigCursor.group).toBe('reading');
    expect(BIG_ARROW_CURSOR).toMatch(/^url\("data:image\/svg\+xml,%3Csvg/);
    expect(BIG_ARROW_CURSOR).toMatch(/,auto$/);
    expect(BIG_HAND_CURSOR).toMatch(/,pointer$/);
    expect(styleText('big-cursor')).toContain(`cursor:${BIG_ARROW_CURSOR}!important`);
    expect(styleText('big-cursor')).toContain(`a[href]${NOT_IGNORED}`);
    expect(styleText('big-cursor')).toContain(`cursor:${BIG_HAND_CURSOR}!important`);
  });
});
