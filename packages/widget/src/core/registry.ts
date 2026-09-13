import type { MessageKey } from '../i18n';
import type { StyleEngine } from './style-engine';

export type FeatureGroup = 'text' | 'color' | 'navigation' | 'reading' | 'distraction';

export const GROUP_ORDER: readonly FeatureGroup[] = ['text', 'color', 'navigation', 'reading', 'distraction'];

export interface FeatureContext {
  doc: Document;
  styles: StyleEngine;
}

export interface FeatureDefinition {
  id: string;
  group: FeatureGroup;
  labelKey: MessageKey;
  levels: number;
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
  return {
    get: (id) => map.get(id),
    list: () => [...map.values()],
  };
}
