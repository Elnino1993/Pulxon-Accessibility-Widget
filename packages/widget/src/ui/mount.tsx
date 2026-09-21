import { render } from 'preact';
import { readableOn } from '../config/contrast';
import type { WidgetOptions } from '../config/options';
import type { Controller } from '../core/controller';
import type { ProfileDefinition, Registry } from '../core/registry';
import type { Settings, SettingsStore } from '../core/store';
import { createStyleEngine, type StyleMode } from '../core/style-engine';
import { createLocaleLoader, isRtl, resolveStoredLanguage, type LocaleLoader, type Translator } from '../i18n';
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
  /** Where the panel gets its languages other than English; none means English only. */
  locales?: LocaleLoader;
  /** Told whenever the panel's language changes (see `App`). */
  onTranslatorChange?: (t: Translator) => void;
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
  const features = input.registry.list().filter((feature) => !feature.isSupported || feature.isSupported(doc));

  const host = doc.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('data-pulxon-ignore', '');
  // `data-pulxon-lang` is read from `document.querySelector`, which never pierces the shadow root
  // below, so it must sit on the light-DOM host, not on `mountPoint` inside the shadow tree. Its
  // value (and the mount point's `lang` attribute below) is set below by `applyUiSettings`, which
  // also keeps both in sync once the visitor changes language from the panel.
  if (options.hideOnMobile) host.setAttribute('data-hide-mobile', '');

  // Lenis (a smooth-scroll library many sites use) leaves an element carrying this attribute to scroll
  // natively; on the host it covers the whole widget, whatever its version reads from the event path.
  host.setAttribute('data-lenis-prevent', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const styles = createStyleEngine(shadow, { nonce: options.nonce, mode: input.styleMode ?? 'auto' });
  styles.set('ui', css);
  const mountPoint = doc.createElement('div');
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

  // `--pulxon-scale`, and the `lang`/`data-pulxon-lang` attributes, reflect the visitor's own panel
  // choices. They live outside the Preact tree (on the mount point and the light-DOM host, which the
  // dictionary feature reads via `document.querySelector`), so they're kept in sync here rather than
  // through JSX. Scale is one CSS custom property both the launcher and the panel read, per the
  // brief's "do not hard-code a second set of sizes".
  const mountedLang = input.lang ?? 'en';
  function applyUiSettings(settings: Settings): void {
    const scale = settings.ui.scale === 'large' ? 1.25 : 1;
    mountPoint.style.setProperty('--pulxon-scale', String(scale));
    const lang = resolveStoredLanguage(settings.lang, mountedLang);
    mountPoint.setAttribute('lang', lang);
    // Arabic, Persian, Hebrew and Urdu lay the panel out mirrored; `dir` inherits into the shadow tree.
    mountPoint.setAttribute('dir', isRtl(lang) ? 'rtl' : 'ltr');
    host.setAttribute('data-pulxon-lang', lang);
  }
  applyUiSettings(input.store.get());
  const unsubscribeUi = input.store.subscribe(applyUiSettings);

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
      unsubscribeUi();
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
      doc={doc}
      options={options}
      controller={input.controller}
      features={features}
      store={input.store}
      profiles={input.profiles}
      t={input.t}
      lang={mountedLang}
      state={state}
      locales={input.locales ?? createLocaleLoader(null)}
      onTranslatorChange={input.onTranslatorChange}
    />,
    mountPoint,
  );

  return handle;
}
