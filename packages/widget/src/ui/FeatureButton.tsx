import type { FeatureDefinition } from '../core/registry';
import type { Translator } from '../i18n';
import { TileIcon } from './icons';

export interface FeatureButtonProps {
  feature: FeatureDefinition;
  level: number;
  t: Translator;
  onActivate: (id: string) => void;
  /** Id of an element (e.g. a privacy note) that describes this tile for assistive tech. */
  describedById?: string;
}

function statusText(feature: FeatureDefinition, level: number, t: Translator): string | null {
  if (feature.levels <= 1) return null;
  if (level <= 0) return t('level.off');
  const named = feature.levelLabelKeys?.[level - 1];
  return named ? t(named) : t('level.of', { current: level, total: feature.levels });
}

export function FeatureButton({ feature, level, t, onActivate, describedById }: FeatureButtonProps) {
  const active = level > 0;
  const multiLevel = feature.levels > 1;
  const status = statusText(feature, level, t);

  return (
    <button
      type="button"
      class="tile"
      data-feature={feature.id}
      aria-pressed={active}
      aria-describedby={describedById}
      onClick={() => onActivate(feature.id)}
    >
      <TileIcon id={feature.id} />
      <span class="tile__label">{t(feature.labelKey)}</span>
      {/* Off / 2 of 4 stays in the button's accessible name, but only the dots show it on screen: a
          compact tile has no room for a third line of text, and the dots already carry it. */}
      {status && <span class="tile__status sr-only">{status}</span>}
      {multiLevel && (
        <span class="tile__dots" aria-hidden="true">
          {Array.from({ length: feature.levels }, (_, index) => (
            <span key={index} class={index < level ? 'dot dot--on' : 'dot'} />
          ))}
        </span>
      )}
    </button>
  );
}
