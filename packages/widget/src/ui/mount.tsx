import { render } from 'preact';
import { readableOn } from '../config/contrast';
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
  /** Resolved widget language, marked on the mount point (defaults to `en`). */
  lang?: string;
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

function isEditable(target: Element | null): boolean {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target as HTMLElement).isContentEditable === true;
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
  mountPoint.setAttribute('lang', input.lang ?? 'en');
  mountPoint.setAttribute('dir', 'ltr');
  mountPoint.style.setProperty('--pulxon-accent', options.color);
  mountPoint.style.setProperty('--pulxon-on-accent', readableOn(options.color));
  mountPoint.style.setProperty('--pulxon-ox', `${options.offsetX}px`);
  mountPoint.style.setProperty('--pulxon-oy', `${options.offsetY}px`);
  mountPoint.style.setProperty('--pulxon-z', String(options.zIndex));
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
    if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyA') return;
    if (event.defaultPrevented || event.repeat || event.isComposing) return;
    if (isEditable((event.composedPath()[0] ?? event.target) as Element | null)) return;
    event.preventDefault();
    handle.toggle();
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
