import { useEffect, useRef } from 'preact/hooks';
import type { WidgetOptions } from '../config/options';
import type { Controller } from '../core/controller';
import type { FeatureDefinition, ProfileDefinition } from '../core/registry';
import type { SettingsStore } from '../core/store';
import type { Translator } from '../i18n';
import { Launcher } from './Launcher';
import { Panel } from './Panel';
import type { UiState } from './ui-state';
import { useExternal } from './use-external';

export interface AppProps {
  options: WidgetOptions;
  controller: Controller;
  features: FeatureDefinition[];
  store: SettingsStore;
  profiles: ProfileDefinition[];
  t: Translator;
  state: UiState;
}

export function App({ options, controller, features, store, profiles, t, state }: AppProps) {
  const open = useExternal(state.subscribe, state.isOpen);
  const settings = useExternal(store.subscribe, store.get);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) {
      const opener = state.opener();
      const target = opener && opener.isConnected ? opener : launcherRef.current;
      target?.focus();
    }
    wasOpen.current = open;
  }, [open, state]);

  const onToggle = (): void => {
    if (state.isOpen()) state.setOpen(false);
    else state.setOpen(true, launcherRef.current);
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
          features={features}
          controller={controller}
          settings={settings}
          profiles={profiles}
          side={side}
          onClose={() => state.setOpen(false)}
        />
      )}
    </>
  );
}
