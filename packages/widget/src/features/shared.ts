import type { FeatureContext, FeatureDefinition, FeatureGroup } from '../core/registry';
import type { MessageKey } from '../i18n';

/** Excludes the widget host and every subtree marked with data-pulxon-ignore. */
export const NOT_IGNORED = ':not([data-pulxon-ignore]):not([data-pulxon-ignore] *)';

export function scoped(selectors: readonly string[], extra = ''): string {
  return selectors.map((selector) => `${selector}${NOT_IGNORED}${extra}`).join(',');
}

export function pick<T>(values: readonly [T, ...T[]], level: number): T {
  const index = Math.min(Math.max(Math.trunc(level), 1), values.length) - 1;
  return values[index] ?? values[0];
}

/** The widget's resolved language, read from the `data-pulxon-lang` attribute `mountUI` sets on its mount point. */
export function widgetLang(doc: Document): string {
  return doc.querySelector('[data-pulxon-lang]')?.getAttribute('data-pulxon-lang') ?? 'en';
}

export interface CssFeatureInput {
  id: string;
  group: FeatureGroup;
  labelKey: MessageKey;
  levels: number;
  levelLabelKeys?: readonly MessageKey[];
  conflictsWith?: string[];
  css(level: number, ctx: FeatureContext): string;
}

export function cssFeature(input: CssFeatureInput): FeatureDefinition {
  const { css, ...definition } = input;
  return {
    ...definition,
    apply: (ctx, level) => ctx.styles.set(input.id, css(level, ctx)),
    teardown: ({ styles }) => styles.remove(input.id),
  };
}
