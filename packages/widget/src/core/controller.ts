import type { FeatureContext, FeatureDefinition, ProfileDefinition, Registry } from './registry';
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
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 1;
  return Math.min(Math.max(numeric, 1), max);
}

function hasOwn(record: Record<string, number>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function createController({ registry, store, ctx, profiles }: ControllerInput): Controller {
  function safely(fn: () => void, id: string): boolean {
    try {
      fn();
      return true;
    } catch (error) {
      console.error('[pulxon] feature failed', id, error);
      return false;
    }
  }

  function supported(def: FeatureDefinition): boolean {
    return !def.isSupported || def.isSupported(ctx.doc);
  }

  function level(id: string): number {
    return store.get().features[id] ?? 0;
  }

  function teardownAll(): void {
    for (const id of Object.keys(store.get().features)) {
      const def = registry.get(id);
      if (def) safely(() => def.teardown(ctx), id);
    }
  }

  function enable(id: string, requested = 1): boolean {
    const def = registry.get(id);
    if (!def || !supported(def)) return false;
    const next = clampLevel(requested, def.levels);
    if (!safely(() => def.apply(ctx, next), id)) return false;
    const conflicts = registry.conflicts(id);
    for (const other of conflicts) {
      const otherDef = registry.get(other);
      if (otherDef && level(other) > 0) safely(() => otherDef.teardown(ctx), other);
    }
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
    safely(() => def.teardown(ctx), id);
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
      if (!def || !supported(def)) continue;
      if (registry.conflicts(featureId).some((other) => hasOwn(features, other))) continue;
      const next = clampLevel(requested, def.levels);
      if (safely(() => def.apply(ctx, next), featureId)) features[featureId] = next;
      else safely(() => def.teardown(ctx), featureId);
    }
    store.update((s) => ({ ...s, features, profile: id }));
    return true;
  }

  function applyAll(): void {
    const stored = store.get().features;
    const features: Record<string, number> = { ...stored };
    const applied = new Set<string>();
    let dropped = false;
    let normalized = false;
    for (const [id, storedLevel] of Object.entries(stored)) {
      const def = registry.get(id);
      if (!def || !supported(def)) continue;
      if (registry.conflicts(id).some((other) => applied.has(other))) {
        delete features[id];
        dropped = true;
        continue;
      }
      const next = clampLevel(storedLevel, def.levels);
      if (safely(() => def.apply(ctx, next), id)) {
        applied.add(id);
        if (next !== storedLevel) {
          features[id] = next;
          normalized = true;
        }
      } else {
        safely(() => def.teardown(ctx), id);
        delete features[id];
        dropped = true;
      }
    }
    if (!dropped && !normalized) return;
    store.update((s) => ({ ...s, features, profile: dropped ? null : s.profile }));
  }

  function destroy(): void {
    teardownAll();
  }

  return { level, enable, disable, toggle, reset, setProfile, applyAll, destroy };
}
