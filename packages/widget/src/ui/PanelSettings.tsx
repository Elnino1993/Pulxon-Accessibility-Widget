import type { JSX } from 'preact';
import type { Position } from '../config/options';
import type { Settings, SettingsStore, WidgetScale } from '../core/store';
import { SUPPORTED_LANGUAGES, type MessageKey, type Translator } from '../i18n';

export interface PanelSettingsProps {
  t: Translator;
  settings: Settings;
  store: SettingsStore;
  lang: string;
  onLangChange: (lang: string | null) => void;
  /** The embed's configured corner, used only until the visitor picks one of their own. */
  optionsPosition: Position;
}

/** The widget's own name for each language it ships, shown regardless of the panel's current language. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
};

/**
 * The spots a visitor can pick: along the bottom edge only, where a launcher that is let go falls to
 * anyway. The short word is what shows; the full name ("Bottom left") is what a screen reader hears,
 * and it contains the short word, so a voice-control user can say what they see (WCAG 2.5.3).
 */
const BOTTOM_POSITIONS: ReadonlyArray<{ position: Position; short: MessageKey; full: MessageKey }> = [
  { position: 'bottom-left', short: 'position.left', full: 'position.bottomLeft' },
  { position: 'bottom-center', short: 'position.center', full: 'position.bottomCenter' },
  { position: 'bottom-right', short: 'position.right', full: 'position.bottomRight' },
];

// `lang` (the panel's currently-resolved language) isn't needed here: the select's own value comes
// straight from `settings.lang`. It stays part of the props contract because the caller (Panel) has
// it on hand and other consumers of this component may want to display it.
export function PanelSettings({ t, settings, store, onLangChange, optionsPosition }: PanelSettingsProps) {
  const scale: WidgetScale = settings.ui.scale;
  // Before the visitor picks a corner of their own, `settings.ui.position` is null — the launcher
  // still sits wherever the embed's own `options.position` put it, so the grid must read that corner
  // as pressed too, or all eight buttons show unpressed while the launcher plainly sits in one of
  // them. `onPositionChange` below still always writes an explicit value on click.
  // A launcher the visitor dragged somewhere sits in no corner at all, so no corner reads as pressed.
  const position = settings.ui.launcher ? null : (settings.ui.position ?? optionsPosition);

  // A `settings.lang` the picker has no matching <option> for (e.g. a value stored by a newer widget
  // version, or a stale/edited value) would otherwise leave the native <select> showing blank — no
  // option matches its `value`. Falling back to "auto" keeps the control always showing something
  // real; `resolveStoredLanguage` (i18n/index.ts) already falls back the same way for the language
  // the panel actually renders in, so this just keeps the picker's own display in sync with that.
  const selectedLang = settings.lang && (SUPPORTED_LANGUAGES as readonly string[]).includes(settings.lang) ? settings.lang : 'auto';

  const onScaleChange = (next: WidgetScale): void => {
    store.update((s) => ({ ...s, ui: { ...s.ui, scale: next } }));
  };

  // Picking a spot is the non-drag way to move the widget (WCAG 2.5.7), so it overrides a drag: the
  // launcher goes there and the panel opens beside it again.
  const onPositionChange = (next: Position): void => {
    store.update((s) => ({ ...s, ui: { ...s.ui, position: next, launcher: null, panel: null } }));
  };

  const onLangSelect = (event: JSX.TargetedEvent<HTMLSelectElement>): void => {
    const value = event.currentTarget.value;
    onLangChange(value === 'auto' ? null : value);
  };

  return (
    <div class="settings">
      <div class="settings-row">
        <label id="pulxon-lang-label" htmlFor="pulxon-lang-select">
          {t('settings.language')}
        </label>
        <select
          id="pulxon-lang-select"
          data-pulxon-lang-picker
          aria-labelledby="pulxon-lang-label"
          value={selectedLang}
          onChange={onLangSelect}
        >
          <option value="auto">{t('settings.languageAuto')}</option>
          {SUPPORTED_LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {LANGUAGE_NAMES[code] ?? code}
            </option>
          ))}
        </select>
      </div>

      <div class="settings-row">
        <span id="pulxon-size-label">{t('settings.size')}</span>
        <div class="segmented" role="group" aria-labelledby="pulxon-size-label">
          <button
            type="button"
            data-pulxon-scale="normal"
            aria-label={t('settings.sizeNormal')}
            aria-pressed={scale === 'normal'}
            onClick={() => onScaleChange('normal')}
          >
            {t('settings.sizeNormal')}
          </button>
          <button
            type="button"
            data-pulxon-scale="large"
            aria-label={t('settings.sizeLarge')}
            aria-pressed={scale === 'large'}
            onClick={() => onScaleChange('large')}
          >
            {t('settings.sizeLarge')}
          </button>
        </div>
      </div>

      <div class="settings-row settings-row--position">
        <span id="pulxon-position-label">{t('settings.position')}</span>
        {/* A position the embed code set outside the bottom row (data-position="top-right") shows
            none of these as pressed: the launcher is honestly in none of them. */}
        <div class="segmented" role="group" aria-labelledby="pulxon-position-label">
          {BOTTOM_POSITIONS.map(({ position: spot, short, full }) => (
            <button
              key={spot}
              type="button"
              data-pulxon-position={spot}
              aria-label={t(full)}
              aria-pressed={position === spot}
              onClick={() => onPositionChange(spot)}
            >
              {t(short)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
