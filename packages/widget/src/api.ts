import type { Controller } from './core/controller';
import type { Emitter, Listener } from './core/emitter';
import type { Settings, SettingsStore } from './core/store';
import type { UiHandle } from './ui/mount';

export interface PulxonEvents {
  change: Settings;
  open: undefined;
  close: undefined;
}

export interface PulxonApi {
  readonly version: string;
  open(): void;
  close(): void;
  toggle(): void;
  reset(): void;
  enable(id: string, level?: number): boolean;
  disable(id: string): void;
  toggleFeature(id: string): void;
  setProfile(id: string | null): boolean;
  getSettings(): Settings;
  on<K extends keyof PulxonEvents>(type: K, listener: Listener<PulxonEvents[K]>): () => void;
  destroy(): void;
}

export interface PublicApiInput {
  version: string;
  controller: Controller;
  store: SettingsStore;
  ui: UiHandle;
  emitter: Emitter<PulxonEvents>;
  onDestroy: () => void;
}

export function createPublicApi({ version, controller, store, ui, emitter, onDestroy }: PublicApiInput): PulxonApi {
  let destroyed = false;
  const api: PulxonApi = {
    version,
    open: () => {
      if (!ui.isOpen()) ui.toggle();
    },
    close: () => ui.close(),
    toggle: () => ui.toggle(),
    reset: () => controller.reset(),
    enable: (id, level) => controller.enable(id, level),
    disable: (id) => controller.disable(id),
    toggleFeature: (id) => controller.toggle(id),
    setProfile: (id) => controller.setProfile(id),
    getSettings: () => store.get(),
    on: (type, listener) => emitter.on(type, listener),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      onDestroy();
    },
  };
  return Object.freeze(api);
}
