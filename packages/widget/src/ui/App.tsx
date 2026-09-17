import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { WidgetOptions } from '../config/options';
import type { Controller } from '../core/controller';
import type { FeatureDefinition, ProfileDefinition } from '../core/registry';
import type { SettingsStore } from '../core/store';
import { createTranslator, resolveStoredLanguage, type Translator } from '../i18n';
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
}

export function App({ doc, options, controller, features, store, profiles, t, lang, state }: AppProps) {
  const open = useExternal(state.subscribe, state.isOpen);
  const settings = useExternal(store.subscribe, store.get);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // The visitor's own language choice (settings.lang) wins once they make one; otherwise the panel
  // falls back to `lang` (the page's own language). Recomputing the translator here, rather than
  // once at mount time in create-widget.ts, is what makes the picker actually re-render the panel:
  // without this, `t` stays frozen to the initial language forever.
  const resolvedLang = resolveStoredLanguage(settings.lang, lang);
  // `t` was built for whatever language first resolved to (create-widget.ts's stored-language-aware
  // `initialLang`), which is this render's `resolvedLang` value the very first time this component
  // runs and never again after — `lang` alone (the page language) is a different thing and, once the
  // visitor's stored choice happens to equal it again after being something else, would wrongly
  // reuse a `t` built for a language that render's `resolvedLang` no longer matches. Capturing that
  // first value once, rather than comparing against `lang`, is what keeps the reuse correct.
  const tHomeLang = useRef(resolvedLang).current;
  const activeT = useMemo(() => (resolvedLang === tHomeLang ? t : createTranslator(resolvedLang)), [resolvedLang, tHomeLang, t]);

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

  const side = position.endsWith('left') ? 'left' : 'right';

  return (
    <>
      <Launcher
        options={options}
        position={position}
        mobilePosition={mobilePosition}
        label={activeT('widget.open')}
        expanded={open}
        onToggle={onToggle}
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
          branding={options.branding}
          statementUrl={options.statementUrl}
          onClose={() => state.setOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}
