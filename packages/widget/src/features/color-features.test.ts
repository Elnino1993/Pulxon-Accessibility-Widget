import { afterEach, describe, expect, it } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { FILTER_RULE, contrast, hideImages, saturation } from './color-features';
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

describe('contrast', () => {
  it('has invert, dark, light and high contrast levels', () => {
    expect(contrast.levels).toBe(4);
    expect(contrast.levelLabelKeys).toEqual(['level.invert', 'level.dark', 'level.light', 'level.high']);
  });

  it('boosts contrast over the whole page at the high level, without undoing it for the widget', () => {
    const ctx = makeCtx();
    contrast.apply(ctx, 4);
    const css = styleText('contrast') ?? '';
    expect(css).toContain('--pulxon-f-contrast:contrast(1.3)');
    expect(css).toContain(FILTER_RULE);
    expect(css).not.toContain('--pulxon-f-undo');
  });

  it('inverts the page and re-inverts media', () => {
    const ctx = makeCtx();
    contrast.apply(ctx, 1);
    const css = styleText('contrast') ?? '';
    expect(css).toContain('--pulxon-f-contrast:invert(1) hue-rotate(180deg)');
    expect(css).toContain(FILTER_RULE);
    expect(css).toContain(`img${NOT_IGNORED}`);
  });

  it('re-inverts the widget overlays and exposes an undo filter for the widget UI', () => {
    const ctx = makeCtx();
    contrast.apply(ctx, 1);
    const css = styleText('contrast') ?? '';
    expect(css).toContain('.pulxon-reading-mask,.pulxon-reading-guide{filter:invert(1) hue-rotate(180deg)!important}');
    expect(css).toContain('--pulxon-f-undo:invert(1) hue-rotate(180deg)');
    contrast.apply(ctx, 2);
    expect(styleText('contrast')).not.toContain('--pulxon-f-undo');
  });

  it('uses a black or white palette with readable link colors', () => {
    const ctx = makeCtx();
    contrast.apply(ctx, 2);
    expect(styleText('contrast')).toContain(
      `html${NOT_IGNORED},body${NOT_IGNORED},body *${NOT_IGNORED}{background-color:#000000!important;color:#ffffff!important`,
    );
    expect(styleText('contrast')).toContain('color:#ffeb3b!important');
    contrast.apply(ctx, 3);
    expect(styleText('contrast')).toContain('background-color:#ffffff!important;color:#000000!important');
    expect(styleText('contrast')).toContain('color:#0000ee!important');
  });
});

describe('saturation', () => {
  it('sets low, high and grayscale filters', () => {
    const ctx = makeCtx();
    expect(saturation.levelLabelKeys).toEqual(['level.low', 'level.high', 'level.grayscale']);
    saturation.apply(ctx, 1);
    expect(styleText('saturation')).toContain('--pulxon-f-saturation:saturate(0.5)');
    saturation.apply(ctx, 3);
    expect(styleText('saturation')).toContain('--pulxon-f-saturation:grayscale(1)');
    expect(styleText('saturation')).toContain(FILTER_RULE);
  });

  it('keeps the shared filter rule when contrast is removed', () => {
    const ctx = makeCtx();
    contrast.apply(ctx, 1);
    saturation.apply(ctx, 2);
    contrast.teardown(ctx);
    expect(styleText('contrast')).toBeNull();
    expect(styleText('saturation')).toContain(FILTER_RULE);
  });
});

describe('hideImages', () => {
  it('hides images and background images outside the widget', () => {
    const ctx = makeCtx();
    hideImages.apply(ctx, 1);
    expect(styleText('hide-images')).toContain(`img${NOT_IGNORED}`);
    expect(styleText('hide-images')).toContain('visibility:hidden!important');
    expect(styleText('hide-images')).toContain('background-image:none!important');
    expect(hideImages.group).toBe('distraction');
  });
});
