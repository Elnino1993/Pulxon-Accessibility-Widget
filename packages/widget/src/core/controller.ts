import type { FeatureContext, ProfileDefinition, Registry } from './registry';
import type { SettingsStore } from './store';

export interface Controller {
  level(id: string): number;
  enable(id: string, level?: number): boolean;
  disable(id: string): void;
  toggle(id: string): void;
  reset(): void;
  setProfile(id: string | null): boolean;
  applyAll(): void;
  destroy(): void;
}

export interface ControllerInput {
  registry: Registry;
  store: SettingsStore;
  ctx: FeatureContext;
  profiles: ProfileDefinition[];
}

function clampLevel(value: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

export function createController({ registry, store, ctx, profiles }: ControllerInput): Controller {
  function level(id: string): number {
    return store.get().features[id] ?? 0;
  }

  function teardownAll(): void {
    for (const id of Object.keys(store.get().features)) registry.get(id)?.teardown(ctx);
  }

  function enable(id: string, requested = 1): boolean {
    const def = registry.get(id);
    if (!def) return false;
    const next = clampLevel(requested, def.levels);
    const conflicts = def.conflictsWith ?? [];
    for (const other of conflicts) {
      if (level(other) > 0) registry.get(other)?.teardown(ctx);
    }
    def.apply(ctx, next);
    store.update((s) => {
      const features = { ...s.features };
      for (const other of conflicts) delete features[other];
      features[id] = next;
      return { ...s, features, profile: null };
    });
    return true;
  }

  function disable(id: string): void {
    const def = registry.get(id);
    if (!def || level(id) === 0) return;
    def.teardown(ctx);
    store.update((s) => {
      const features = { ...s.features };
      delete features[id];
      return { ...s, features, profile: null };
    });
  }

  function toggle(id: string): void {
    const def = registry.get(id);
    if (!def) return;
    const current = level(id);
    if (current >= def.levels) disable(id);
    else enable(id, current + 1);
  }

  function reset(): void {
    teardownAll();
    store.update((s) => ({ ...s, features: {}, profile: null }));
  }

  function setProfile(id: string | null): boolean {
    if (id === null) {
      reset();
      return true;
    }
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return false;
    teardownAll();
    const features: Record<string, number> = {};
    for (const [featureId, requested] of Object.entries(profile.features)) {
      const def = registry.get(featureId);
      if (!def) continue;
      const next = clampLevel(requested, def.levels);
      def.apply(ctx, next);
      features[featureId] = next;
    }
    store.update((s) => ({ ...s, features, profile: id }));
    return true;
  }

  function applyAll(): void {
    for (const [id, stored] of Object.entries(store.get().features)) {
      const def = registry.get(id);
      if (def) def.apply(ctx, clampLevel(stored, def.levels));
    }
  }

  function destroy(): void {
    teardownAll();
  }

  return { level, enable, disable, toggle, reset, setProfile, applyAll, destroy };
}
