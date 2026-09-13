import { render } from 'preact';
import type { WidgetOptions } from '../config/options';
import type { Controller } from '../core/controller';
import type { ProfileDefinition, Registry } from '../core/registry';
import type { SettingsStore } from '../core/store';
import { createStyleEngine, type StyleMode } from '../core/style-engine';
import type { Translator } from '../i18n';
import { App } from './App';
import css from './styles.css?inline';
import { createUiState } from './ui-state';

export const HOST_ID = 'pulxon-root';

export interface MountUiInput {
  doc: Document;
  options: WidgetOptions;
  controller: Controller;
  registry: Registry;
  store: SettingsStore;
  profiles: ProfileDefinition[];
  t: Translator;
  styleMode?: StyleMode;
  onOpenChange?: (open: boolean) => void;
}

export interface UiHandle {
  host: HTMLElement;
  open(opener?: HTMLElement | null): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

function isValidSelector(doc: Document, selector: string): boolean {
  try {
    doc.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

export function mountUI(input: MountUiInput): UiHandle {
  const { doc, options } = input;

  const host = doc.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('data-pulxon-ignore', '');
  if (options.hideOnMobile) host.setAttribute('data-hide-mobile', '');

  const shadow = host.attachShadow({ mode: 'open' });
  const styles = createStyleEngine(shadow, { nonce: options.nonce, mode: input.styleMode ?? 'auto' });
  styles.set('ui', css);
  const mountPoint = doc.createElement('div');
  shadow.appendChild(mountPoint);
  doc.body.appendChild(host);

  const state = createUiState();
  const unsubscribe = state.subscribe((open) => input.onOpenChange?.(open));
  const trigger = options.trigger && isValidSelector(doc, options.trigger) ? options.trigger : null;

  function currentFocus(): HTMLElement | null {
    const active = doc.activeElement as HTMLElement | null;
    return active && active !== host && active !== doc.body ? active : null;
  }

  const handle: UiHandle = {
    host,
    open: (opener = null) => state.setOpen(true, opener),
    close: () => state.setOpen(false),
    toggle: () => {
      if (state.isOpen()) state.setOpen(false);
      else state.setOpen(true, currentFocus());
    },
    isOpen: () => state.isOpen(),
    destroy: () => {
      doc.removeEventListener('keydown', onHotkey);
      doc.removeEventListener('click', onTriggerClick, true);
      unsubscribe();
      render(null, mountPoint);
      styles.clear();
      host.remove();
    },
  };

  function onHotkey(event: KeyboardEvent): void {
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyA') {
      event.preventDefault();
      handle.toggle();
    }
  }

  function onTriggerClick(event: MouseEvent): void {
    if (!trigger) return;
    const target = event.target as Element | null;
    const el = target?.closest?.(trigger) as HTMLElement | null | undefined;
    if (!el) return;
    event.preventDefault();
    state.setOpen(true, el);
  }

  doc.addEventListener('keydown', onHotkey);
  if (trigger) doc.addEventListener('click', onTriggerClick, true);

  render(
    <App
      options={options}
      controller={input.controller}
      registry={input.registry}
      store={input.store}
      profiles={input.profiles}
      t={input.t}
      state={state}
    />,
    mountPoint,
  );

  return handle;
}
