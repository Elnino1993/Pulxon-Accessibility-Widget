import type { Position } from '../config/options';
import { isPosition } from '../config/options';
import type { KeyValueStorage } from './storage';

export type FeatureLevels = Record<string, number>;

export type WidgetScale = 'normal' | 'large';

/**
 * Where the visitor dragged something, as fractions of the room it has to move in: 0 is flush with
 * the left/top edge, 1 with the right/bottom one. Fractions, not pixels, so the spot survives a
 * resized window or a rotated phone (see `spotToPoint` in ui/drag.ts).
 */
export interface DragSpot {
  x: number;
  y: number;
}

export interface WidgetUiSettings {
  scale: WidgetScale;
  /** null means "keep whatever the embed code chose". */
  position: Position | null;
  /** Where the visitor dragged the launcher. Wins over `position` until they pick a corner again. */
  launcher: DragSpot | null;
  /** Where the visitor dragged the open panel. null opens it beside the launcher. */
  panel: DragSpot | null;
}

export const DEFAULT_UI_SETTINGS: WidgetUiSettings = Object.freeze({ scale: 'normal', position: null, launcher: null, panel: null });

export interface Settings {
  v: 1;
  features: FeatureLevels;
  profile: string | null;
  lang: string | null;
  ui: WidgetUiSettings;
}

export const SETTINGS_KEY = 'pulxon:settings';

export const EMPTY_SETTINGS: Settings = Object.freeze({
  v: 1,
  features: Object.freeze({}) as FeatureLevels,
  profile: null,
  lang: null,
  ui: DEFAULT_UI_SETTINGS,
}) as Settings;

const MAX_LEVEL = 10;

function freezeSettings(settings: Settings): Settings {
  Object.freeze(settings.features);
  Object.freeze(settings.ui);
  return Object.freeze(settings);
}

function emptySettings(): Settings {
  return freezeSettings({ v: 1, features: {}, profile: null, lang: null, ui: DEFAULT_UI_SETTINGS });
}

function isFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** A stored spot, or null when it is missing or anything but two fractions in [0, 1]. */
function parseSpot(value: unknown): DragSpot | null {
  if (!isRecord(value) || !isFraction(value.x) || !isFraction(value.y)) return null;
  return Object.freeze({ x: value.x, y: value.y });
}

function parseUiSettings(value: unknown): WidgetUiSettings {
  if (!isRecord(value)) return DEFAULT_UI_SETTINGS;
  return {
    scale: value.scale === 'normal' || value.scale === 'large' ? value.scale : DEFAULT_UI_SETTINGS.scale,
    position: isPosition(value.position) ? value.position : DEFAULT_UI_SETTINGS.position,
    launcher: parseSpot(value.launcher),
    panel: parseSpot(value.panel),
  };
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
      ui: parseUiSettings(data.ui),
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
