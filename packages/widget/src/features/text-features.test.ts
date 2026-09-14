import { afterEach, describe, expect, it } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { NOT_IGNORED, cssFeature, pick, scoped } from './shared';
import { boldText, lineHeight, textAlign, textSpacing } from './text-features';

function makeCtx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

function styleText(id: string): string | null {
  return document.head.querySelector(`style[data-pulxon-style="${id}"]`)?.textContent ?? null;
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('shared helpers', () => {
  it('scoped appends the ignore exclusion to every selector', () => {
    expect(scoped(['p', 'a'])).toBe(`p${NOT_IGNORED},a${NOT_IGNORED}`);
    expect(scoped(['p'], ':not(i)')).toBe(`p${NOT_IGNORED}:not(i)`);
    expect(NOT_IGNORED).toBe(':not([data-pulxon-ignore]):not([data-pulxon-ignore] *)');
  });

  it('pick clamps the level into the value list', () => {
    const values = ['a', 'b', 'c'] as const;
    expect(pick(values, 1)).toBe('a');
    expect(pick(values, 3)).toBe('c');
    expect(pick(values, 9)).toBe('c');
    expect(pick(values, 0)).toBe('a');
    expect(pick(values, Number.NaN)).toBe('a');
  });

  it('cssFeature sets and removes a stylesheet named after the feature', () => {
    const feature = cssFeature({
      id: 'demo',
      group: 'text',
      labelKey: 'feature.boldText',
      levels: 2,
      css: (level) => `p{order:${level}}`,
    });
    const ctx = makeCtx();
    feature.apply(ctx, 2);
    expect(styleText('demo')).toBe('p{order:2}');
    feature.teardown(ctx);
    expect(styleText('demo')).toBeNull();
  });
});

describe('text features', () => {
  it('bold-text makes page text bold outside the widget', () => {
    const ctx = makeCtx();
    boldText.apply(ctx, 1);
    expect(styleText('bold-text')).toContain('font-weight:700!important');
    expect(styleText('bold-text')).toContain(`body *${NOT_IGNORED}`);
  });

  it('line-height uses 1.5, 1.75 and 2', () => {
    const ctx = makeCtx();
    expect(lineHeight.levels).toBe(3);
    lineHeight.apply(ctx, 1);
    expect(styleText('line-height')).toContain('line-height:1.5!important');
    lineHeight.apply(ctx, 3);
    expect(styleText('line-height')).toContain('line-height:2!important');
  });

  it('text-spacing follows WCAG 1.4.12 at level 1', () => {
    const ctx = makeCtx();
    textSpacing.apply(ctx, 1);
    expect(styleText('text-spacing')).toContain('letter-spacing:0.12em!important;word-spacing:0.16em!important');
    expect(styleText('text-spacing')).toContain('margin-bottom:2em!important');
    textSpacing.apply(ctx, 3);
    expect(styleText('text-spacing')).toContain('letter-spacing:0.2em!important;word-spacing:0.32em!important');
  });

  it('text-align cycles left, right, center, justify with named levels', () => {
    const ctx = makeCtx();
    expect(textAlign.levels).toBe(4);
    expect(textAlign.levelLabelKeys).toEqual(['level.left', 'level.right', 'level.center', 'level.justify']);
    textAlign.apply(ctx, 4);
    expect(styleText('text-align')).toContain('text-align:justify!important');
    textAlign.teardown(ctx);
    expect(styleText('text-align')).toBeNull();
  });
});
