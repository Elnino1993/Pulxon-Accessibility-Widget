import type { KeyValueStorage } from './storage';

export type FeatureLevels = Record<string, number>;

export interface Settings {
  v: 1;
  features: FeatureLevels;
  profile: string | null;
  lang: string | null;
}

export const SETTINGS_KEY = 'pulxon:settings';

export const EMPTY_SETTINGS: Settings = Object.freeze({
  v: 1,
  features: Object.freeze({}) as FeatureLevels,
  profile: null,
  lang: null,
}) as Settings;

const MAX_LEVEL = 10;

function freezeSettings(settings: Settings): Settings {
  Object.freeze(settings.features);
  return Object.freeze(settings);
}

function emptySettings(): Settings {
  return freezeSettings({ v: 1, features: {}, profile: null, lang: null });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readStoredVersion(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return isRecord(data) && typeof data.v === 'number' && Number.isInteger(data.v) ? data.v : null;
  } catch {
    return null;
  }
}

export function parseSettings(raw: string | null): Settings {
  if (!raw) return emptySettings();
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.v !== 1) return emptySettings();
    const features: FeatureLevels = {};
    if (isRecord(data.features)) {
      for (const [id, level] of Object.entries(data.features)) {
        if (typeof level === 'number' && Number.isInteger(level) && level > 0 && level <= MAX_LEVEL) {
          features[id] = level;
        }
      }
    }
    return freezeSettings({
      v: 1,
      features,
      profile: typeof data.profile === 'string' ? data.profile : null,
      lang: typeof data.lang === 'string' ? data.lang : null,
    });
  } catch {
    return emptySettings();
  }
}

export interface SettingsStore {
  get(): Settings;
  update(fn: (s: Settings) => Settings): void;
  subscribe(listener: (s: Settings) => void): () => void;
}

export function createSettingsStore(storage: KeyValueStorage): SettingsStore {
  const raw = storage.get(SETTINGS_KEY);
  const storedVersion = readStoredVersion(raw);
  // Data from a newer widget version must survive an older cached script: keep changes in memory only.
  const readOnly = storedVersion !== null && storedVersion > 1;
  let state = parseSettings(raw);
  const listeners = new Set<(s: Settings) => void>();

  return {
    get: () => state,
    update: (fn) => {
      state = freezeSettings(fn(state));
      if (!readOnly) storage.set(SETTINGS_KEY, JSON.stringify(state));
      for (const listener of listeners) listener(state);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
