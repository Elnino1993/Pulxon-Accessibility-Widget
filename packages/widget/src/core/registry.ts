import type { MessageKey } from '../i18n';
import type { StyleEngine } from './style-engine';

export type FeatureGroup = 'text' | 'color' | 'navigation' | 'reading' | 'distraction';

export const GROUP_ORDER: readonly FeatureGroup[] = ['text', 'color', 'navigation', 'reading', 'distraction'];

export interface FeatureContext {
  doc: Document;
  styles: StyleEngine;
}

/**
 * A user-facing adjustment.
 *
 * Resource contract: `apply` and `teardown` may only touch resources the feature owns — its own
 * style-engine id (equal to `id`), `data-pulxon-*` attributes and `pulxon-*` elements it created.
 * `apply` may be called again with another level while active; `teardown` must restore the page.
 */
export interface FeatureDefinition {
  id: string;
  group: FeatureGroup;
  labelKey: MessageKey;
  levels: number;
  /** Declared in one direction; the registry makes conflicts symmetric. */
  conflictsWith?: string[];
  apply(ctx: FeatureContext, level: number): void;
  teardown(ctx: FeatureContext): void;
}

export interface ProfileDefinition {
  id: string;
  labelKey: MessageKey;
  features: Record<string, number>;
}

export interface Registry {
  get(id: string): FeatureDefinition | undefined;
  list(): FeatureDefinition[];
  conflicts(id: string): string[];
}

export function createRegistry(definitions: FeatureDefinition[]): Registry {
  const map = new Map<string, FeatureDefinition>();
  for (const def of definitions) {
    if (map.has(def.id)) throw new Error(`[pulxon] duplicate feature id: ${def.id}`);
    if (!Number.isInteger(def.levels) || def.levels < 1) {
      throw new Error(`[pulxon] invalid levels for feature: ${def.id}`);
    }
    map.set(def.id, def);
  }

  const conflictMap = new Map<string, Set<string>>();
  const link = (from: string, to: string): void => {
    const set = conflictMap.get(from) ?? new Set<string>();
    set.add(to);
    conflictMap.set(from, set);
  };
  for (const def of definitions) {
    for (const other of def.conflictsWith ?? []) {
      if (other === def.id) throw new Error(`[pulxon] feature cannot conflict with itself: ${def.id}`);
      // A conflict with a feature that is not registered cannot happen, so it is ignored.
      if (!map.has(other)) continue;
      link(def.id, other);
      link(other, def.id);
    }
  }

  return {
    get: (id) => map.get(id),
    list: () => [...map.values()],
    conflicts: (id) => [...(conflictMap.get(id) ?? [])],
  };
}
