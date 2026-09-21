import { createPublicApi, type PulxonApi, type PulxonEvents } from './api';
import { resolveOptions, type WidgetOptions } from './config/options';
import { createController } from './core/controller';
import { Emitter } from './core/emitter';
import { createRegistry, type FeatureDefinition, type ProfileDefinition } from './core/registry';
import { createSafeStorage, type KeyValueStorage } from './core/storage';
import { createSettingsStore } from './core/store';
import { createStyleEngine, type StyleMode } from './core/style-engine';
import { builtinFeatures } from './features';
import { createLocaleLoader, createTranslator, resolveLanguage, type Translator } from './i18n';
import { builtinProfiles } from './profiles';
import { mountUI } from './ui/mount';
import { VERSION } from './version';

export interface CreateWidgetInput {
  options?: Partial<WidgetOptions>;
  document?: Document;
  storage?: KeyValueStorage;
  features?: FeatureDefinition[];
  profiles?: ProfileDefinition[];
  styleMode?: StyleMode;
  /** Called once at the end of `destroy()`. */
  onDestroy?: () => void;
}

export function filterFeatures(features: FeatureDefinition[], disabled: readonly string[]): FeatureDefinition[] {
  if (disabled.length === 0) return features;
  const off = new Set(disabled);
  return features.filter((feature) => !off.has(feature.id));
}

export function filterProfiles(profiles: ProfileDefinition[], disabled: readonly string[]): ProfileDefinition[] {
  if (disabled.length === 0) return profiles;
  const off = new Set(disabled);
  return profiles.filter((profile) => Object.keys(profile.features).every((id) => !off.has(id)));
}

export function createWidget(input: CreateWidgetInput = {}): PulxonApi {
  const doc = input.document ?? document;
  const win = doc.defaultView ?? undefined;
  const options = resolveOptions(input.options ?? {});
  const store = createSettingsStore(input.storage ?? createSafeStorage(win));
  const styles = createStyleEngine(doc, { nonce: options.nonce, mode: input.styleMode ?? 'auto' });
  const registry = createRegistry(filterFeatures(input.features ?? builtinFeatures, options.disabledFeatures));
  const profiles = filterProfiles(input.profiles ?? builtinProfiles, options.disabledFeatures);
  // Whatever language the panel is in right now, for text features put on the page. Starts in
  // English; the panel replaces it as soon as it has its language.
  const translation: { current: Translator } = { current: createTranslator('en') };
  const controller = createController({
    registry,
    store,
    ctx: { doc, styles, fontBaseUrl: options.fontBaseUrl, zIndex: options.zIndex, getTranslator: () => translation.current },
    profiles,
  });
  const emitter = new Emitter<PulxonEvents>();

  controller.applyAll();

  // `pageLang` is the site's own language (embed code / dashboard config / browser default), never
  // folding in the visitor's stored choice. It becomes `App`'s `lang` prop — the fallback "auto"
  // falls back to — so clearing a stored choice (the panel's "Match this site" option) really lands
  // back on the page, not on the very choice being undone. `initialLang` keeps today's behaviour for
  // the translator `mountUI` renders with before the visitor touches anything: the stored choice
  // when there is one, otherwise the same page language.
  const pageLang = resolveLanguage(options.lang, doc, win?.navigator);
  const initialLang = resolveLanguage(store.get().lang ?? options.lang, doc, win?.navigator);
  const ui = mountUI({
    doc,
    options,
    controller,
    registry,
    store,
    profiles,
    t: createTranslator(initialLang),
    lang: pageLang,
    locales: createLocaleLoader(options.localeBaseUrl),
    onTranslatorChange: (t) => {
      translation.current = t;
    },
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
      try {
        unsubscribe();
        ui.destroy();
        controller.destroy();
        styles.clear();
        emitter.clear();
      } finally {
        input.onDestroy?.();
      }
    },
  });
}
