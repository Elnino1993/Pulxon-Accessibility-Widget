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
}

/** The widget's own name for each language it ships, shown regardless of the panel's current language. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
};

const POSITION_LABELS: Record<Position, MessageKey> = {
  'top-left': 'position.topLeft',
  'top-center': 'position.topCenter',
  'top-right': 'position.topRight',
  'center-left': 'position.centerLeft',
  'center-right': 'position.centerRight',
  'bottom-left': 'position.bottomLeft',
  'bottom-center': 'position.bottomCenter',
  'bottom-right': 'position.bottomRight',
};

// Row-major layout for a 3x3 grid; `null` is the empty middle cell — `Position` has no true center.
const GRID_CELLS: Array<Position | null> = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  null,
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

// `lang` (the panel's currently-resolved language) isn't needed here: the select's own value comes
// straight from `settings.lang`. It stays part of the props contract because the caller (Panel) has
// it on hand and other consumers of this component may want to display it.
export function PanelSettings({ t, settings, store, onLangChange }: PanelSettingsProps) {
  const scale: WidgetScale = settings.ui.scale;
  const position = settings.ui.position;

  const onScaleChange = (next: WidgetScale): void => {
    store.update((s) => ({ ...s, ui: { ...s.ui, scale: next } }));
  };

  const onPositionChange = (next: Position): void => {
    store.update((s) => ({ ...s, ui: { ...s.ui, position: next } }));
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
          value={settings.lang ?? 'auto'}
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
        <div class="corner-grid" role="group" aria-labelledby="pulxon-position-label">
          {GRID_CELLS.map((cell, index) => {
            if (!cell) return <span key={`spacer-${index}`} class="corner-grid__spacer" aria-hidden="true" />;
            const active = position === cell;
            return (
              <button
                key={cell}
                type="button"
                data-pulxon-position={cell}
                aria-label={t(POSITION_LABELS[cell])}
                aria-pressed={active}
                onClick={() => onPositionChange(cell)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
