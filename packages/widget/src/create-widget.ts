import { createPublicApi, type PulxonApi, type PulxonEvents } from './api';
import { resolveOptions, type WidgetOptions } from './config/options';
import { createController } from './core/controller';
import { Emitter } from './core/emitter';
import { createRegistry, type FeatureDefinition, type ProfileDefinition } from './core/registry';
import { createSafeStorage, type KeyValueStorage } from './core/storage';
import { createSettingsStore } from './core/store';
import { createStyleEngine, type StyleMode } from './core/style-engine';
import { builtinFeatures } from './features';
import { createTranslator, resolveLanguage } from './i18n';
import { mountUI } from './ui/mount';
import { VERSION } from './version';

export interface CreateWidgetInput {
  options?: Partial<WidgetOptions>;
  document?: Document;
  storage?: KeyValueStorage;
  features?: FeatureDefinition[];
  profiles?: ProfileDefinition[];
  styleMode?: StyleMode;
}

export function createWidget(input: CreateWidgetInput = {}): PulxonApi {
  const doc = input.document ?? document;
  const win = doc.defaultView ?? undefined;
  const options = resolveOptions(input.options ?? {});
  const store = createSettingsStore(input.storage ?? createSafeStorage(win));
  const styles = createStyleEngine(doc, { nonce: options.nonce, mode: input.styleMode ?? 'auto' });
  const registry = createRegistry(input.features ?? builtinFeatures);
  const profiles = input.profiles ?? [];
  const controller = createController({ registry, store, ctx: { doc, styles }, profiles });
  const emitter = new Emitter<PulxonEvents>();

  controller.applyAll();

  const lang = resolveLanguage(store.get().lang ?? options.lang, doc, win?.navigator);
  const ui = mountUI({
    doc,
    options,
    controller,
    registry,
    store,
    profiles,
    t: createTranslator(lang),
    styleMode: input.styleMode,
    onOpenChange: (open) => emitter.emit(open ? 'open' : 'close', undefined),
  });

  const EventCtor = win?.CustomEvent ?? CustomEvent;
  const unsubscribe = store.subscribe((settings) => {
    emitter.emit('change', settings);
    doc.dispatchEvent(new EventCtor('pulxon:change', { detail: settings }));
  });

  return createPublicApi({
    version: VERSION,
    controller,
    store,
    ui,
    emitter,
    onDestroy: () => {
      unsubscribe();
      ui.destroy();
      controller.destroy();
      styles.clear();
      emitter.clear();
    },
  });
}
