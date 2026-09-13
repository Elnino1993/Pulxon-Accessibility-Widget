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

function emptySettings(): Settings {
  return { v: 1, features: {}, profile: null, lang: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    return {
      v: 1,
      features,
      profile: typeof data.profile === 'string' ? data.profile : null,
      lang: typeof data.lang === 'string' ? data.lang : null,
    };
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
  let state = parseSettings(storage.get(SETTINGS_KEY));
  const listeners = new Set<(s: Settings) => void>();

  return {
    get: () => state,
    update: (fn) => {
      state = fn(state);
      storage.set(SETTINGS_KEY, JSON.stringify(state));
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
