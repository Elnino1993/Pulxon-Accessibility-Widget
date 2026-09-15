import { useEffect, useRef } from 'preact/hooks';
import type { WidgetOptions } from '../config/options';
import type { Controller } from '../core/controller';
import type { FeatureDefinition, ProfileDefinition } from '../core/registry';
import type { SettingsStore } from '../core/store';
import type { Translator } from '../i18n';
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
  state: UiState;
}

export function App({ doc, options, controller, features, store, profiles, t, state }: AppProps) {
  const open = useExternal(state.subscribe, state.isOpen);
  const settings = useExternal(store.subscribe, store.get);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

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

  const side = options.position.endsWith('left') ? 'left' : 'right';

  return (
    <>
      <Launcher
        options={options}
        label={t('widget.open')}
        expanded={open}
        onToggle={onToggle}
        buttonRef={launcherRef}
      />
      {open && (
        <Panel
          t={t}
          doc={doc}
          features={features}
          controller={controller}
          settings={settings}
          profiles={profiles}
          side={side}
          branding={options.branding}
          onClose={() => state.setOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}
