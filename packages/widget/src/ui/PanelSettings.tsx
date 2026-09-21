import type { JSX } from 'preact';
import type { Position } from '../config/options';
import type { Settings, SettingsStore, WidgetScale } from '../core/store';
import { LANGUAGES, SUPPORTED_LANGUAGES, type MessageKey, type Translator } from '../i18n';

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

export interface LanguageAndSizeProps {
  t: Translator;
  settings: Settings;
  store: SettingsStore;
  onLangChange: (lang: string | null) => void;
}

/** The top card: the panel's language and the widget's size, the two settings about the panel itself. */
export function LanguageAndSize({ t, settings, store, onLangChange }: LanguageAndSizeProps) {
  const scale: WidgetScale = settings.ui.scale;

  // A `settings.lang` the picker has no matching <option> for (e.g. a value stored by a newer widget
  // version, or a stale/edited value) would otherwise leave the native <select> showing blank — no
  // option matches its `value`. Falling back to "auto" keeps the control always showing something
  // real; `resolveStoredLanguage` (i18n/index.ts) already falls back the same way for the language
  // the panel actually renders in, so this just keeps the picker's own display in sync with that.
  const selectedLang = settings.lang && SUPPORTED_LANGUAGES.includes(settings.lang) ? settings.lang : 'auto';

  const onScaleChange = (next: WidgetScale): void => {
    store.update((s) => ({ ...s, ui: { ...s.ui, scale: next } }));
  };

  const onLangSelect = (event: JSX.TargetedEvent<HTMLSelectElement>): void => {
    const value = event.currentTarget.value;
    onLangChange(value === 'auto' ? null : value);
  };

  return (
    <div class="card settings">
      <label id="pulxon-lang-label" htmlFor="pulxon-lang-select" class="sr-only">
        {t('settings.language')}
      </label>
      <select
        id="pulxon-lang-select"
        class="language-select"
        data-pulxon-lang-picker
        aria-labelledby="pulxon-lang-label"
        value={selectedLang}
        onChange={onLangSelect}
      >
        <option value="auto">{t('settings.languageAuto')}</option>
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code} lang={language.code} dir={language.rtl ? 'rtl' : 'ltr'}>
            {language.label}
          </option>
        ))}
      </select>

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
    </div>
  );
}

export interface PositionAndResetProps {
  t: Translator;
  settings: Settings;
  store: SettingsStore;
  /** The embed's configured corner, used only until the visitor picks one of their own. */
  optionsPosition: Position;
  onReset: () => void;
}

/** The bottom card: where the launcher sits, and the button that turns every adjustment off. */
export function PositionAndReset({ t, settings, store, optionsPosition, onReset }: PositionAndResetProps) {
  // A launcher the visitor dragged somewhere sits in no corner at all, so no spot reads as pressed.
  const position = settings.ui.launcher ? null : (settings.ui.position ?? optionsPosition);

  // Picking a spot is the non-drag way to move the widget (WCAG 2.5.7), so it overrides a drag: the
  // launcher goes there and the panel docks beside it again.
  const onPositionChange = (next: Position): void => {
    store.update((s) => ({ ...s, ui: { ...s.ui, position: next, launcher: null, panel: null } }));
  };

  return (
    <div class="card settings">
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
      <button type="button" class="reset" data-pulxon-reset onClick={onReset}>
        {t('panel.reset')}
      </button>
    </div>
  );
}
