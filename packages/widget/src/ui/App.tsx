import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { WidgetOptions } from '../config/options';
import type { Controller } from '../core/controller';
import type { FeatureDefinition, ProfileDefinition } from '../core/registry';
import type { DragSpot, SettingsStore } from '../core/store';
import { createTranslator, resolveStoredLanguage, type LocaleLoader, type Translator } from '../i18n';
import { Launcher } from './Launcher';
import { Panel } from './Panel';
import { focusElement } from './page-structure';
import type { UiState } from './ui-state';
import { useExternal } from './use-external';

export interface AppProps {
  doc: Document;
  options: WidgetOptions;
  controller: Controller;
  features: FeatureDefinition[];
  store: SettingsStore;
  profiles: ProfileDefinition[];
  t: Translator;
  /** The language the widget was mounted with (embed code / dashboard config / browser default). */
  lang: string;
  state: UiState;
  /** Fetches the panel's languages other than English, the first time each is used. */
  locales: LocaleLoader;
  /** Told whenever the panel's language changes, so text the widget puts on the page follows it. */
  onTranslatorChange?: (t: Translator) => void;
}

export function App({ doc, options, controller, features, store, profiles, t, lang, state, locales, onTranslatorChange }: AppProps) {
  const open = useExternal(state.subscribe, state.isOpen);
  const settings = useExternal(store.subscribe, store.get);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // The visitor's own language choice (settings.lang) wins once they make one; otherwise the panel
  // falls back to `lang` (the page's own language). Recomputing the translator here, rather than
  // once at mount time in create-widget.ts, is what makes the picker actually re-render the panel:
  // without this, `t` stays frozen to the initial language forever.
  const resolvedLang = resolveStoredLanguage(settings.lang, lang);

  // Every language but English is a file fetched on first use. Until it arrives the panel keeps the
  // language it was showing, rather than flashing English in between; if it never arrives (the site
  // does not host the locales) the panel simply stays in that language.
  const [, setLoadedCount] = useState(0);
  const messages = locales.get(resolvedLang);
  useEffect(() => {
    if (messages) return;
    let current = true;
    void locales.load(resolvedLang).then((loaded) => {
      if (current && loaded) setLoadedCount((count) => count + 1);
    });
    return () => {
      current = false;
    };
  }, [resolvedLang, messages, locales]);
  const lastT = useRef(t);
  const activeT = useMemo(() => (messages ? createTranslator(resolvedLang, messages) : lastT.current), [resolvedLang, messages]);
  lastT.current = activeT;

  useEffect(() => {
    onTranslatorChange?.(activeT);
  }, [activeT, onTranslatorChange]);

  const onLangChange = (next: string | null): void => {
    store.update((s) => ({ ...s, lang: next }));
  };

  // The visitor's chosen corner wins over the embed code's default on every screen size. It also
  // wins over `options.mobilePosition` on narrow screens once they've chosen one: the mobile
  // override exists so a site owner can dodge their own mobile chrome, but the visitor picking a
  // corner is the same kind of decision made more specifically, so it should not be clobbered by a
  // media query the visitor never sees the reasoning for. Until they choose, `mobilePosition` keeps
  // behaving exactly as it does today.
  const position = settings.ui.position ?? options.position;
  const mobilePosition = settings.ui.position ? null : options.mobilePosition;

  const focusOpenerOrLauncher = (): void => {
    const opener = state.opener();
    const target = opener && opener.isConnected ? opener : launcherRef.current;
    target?.focus();
  };

  useEffect(() => {
    if (wasOpen.current && !open && state.shouldReturnFocus()) {
      focusOpenerOrLauncher();
    }
    wasOpen.current = open;
  }, [open, state]);

  const onToggle = (): void => {
    if (state.isOpen()) state.setOpen(false);
    else state.setOpen(true, launcherRef.current);
  };

  const onNavigate = (element: HTMLElement): void => {
    if (!element.isConnected) {
      state.setOpen(false);
      return;
    }
    state.setOpen(false, null, false);
    if (!focusElement(element)) focusOpenerOrLauncher();
  };

  // The falling launcher is motion the visitor did not ask for: skip it when they asked their OS, or
  // this widget, for less motion.
  const reduceMotion =
    (settings.features['pause-animations'] ?? 0) > 0 || (doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  const onLauncherDrop = (spot: DragSpot): void => {
    store.update((s) => ({ ...s, ui: { ...s.ui, launcher: spot } }));
  };

  const onPanelDrop = (spot: DragSpot): void => {
    store.update((s) => ({ ...s, ui: { ...s.ui, panel: spot } }));
  };

  // The panel docks to the launcher's side of the screen: where it was dragged to, or its corner. A
  // launcher in the middle of the bottom edge docks the panel on the left, where reading starts.
  const side: 'left' | 'right' = settings.ui.launcher
    ? settings.ui.launcher.x > 0.5
      ? 'right'
      : 'left'
    : position.endsWith('right')
      ? 'right'
      : 'left';

  return (
    <>
      <Launcher
        options={options}
        position={position}
        mobilePosition={mobilePosition}
        spot={settings.ui.launcher}
        scale={settings.ui.scale}
        label={activeT('widget.open')}
        expanded={open}
        onToggle={onToggle}
        onDrop={onLauncherDrop}
        reduceMotion={reduceMotion}
        buttonRef={launcherRef}
      />
      {open && (
        <Panel
          t={activeT}
          doc={doc}
          features={features}
          controller={controller}
          settings={settings}
          store={store}
          lang={resolvedLang}
          onLangChange={onLangChange}
          optionsPosition={options.position}
          profiles={profiles}
          side={side}
          spot={settings.ui.panel}
          onDrop={onPanelDrop}
          branding={options.branding}
          statementUrl={options.statementUrl}
          onClose={() => state.setOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}
