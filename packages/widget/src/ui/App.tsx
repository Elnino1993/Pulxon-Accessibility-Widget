import { useRef } from 'preact/hooks';
import type { WidgetOptions } from '../config/options';
import type { Controller } from '../core/controller';
import type { ProfileDefinition, Registry } from '../core/registry';
import type { SettingsStore } from '../core/store';
import type { Translator } from '../i18n';
import { Launcher } from './Launcher';
import type { UiState } from './ui-state';
import { useExternal } from './use-external';

export interface AppProps {
  options: WidgetOptions;
  controller: Controller;
  registry: Registry;
  store: SettingsStore;
  profiles: ProfileDefinition[];
  t: Translator;
  state: UiState;
}

export function App({ options, t, state }: AppProps) {
  const open = useExternal(state.subscribe, state.isOpen);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const onToggle = (): void => {
    if (state.isOpen()) state.setOpen(false);
    else state.setOpen(true, launcherRef.current);
  };

  return (
    <Launcher options={options} label={t('widget.open')} expanded={open} onToggle={onToggle} buttonRef={launcherRef} />
  );
}
