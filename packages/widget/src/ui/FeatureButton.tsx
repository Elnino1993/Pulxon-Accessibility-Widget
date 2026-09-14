import type { FeatureDefinition } from '../core/registry';
import type { Translator } from '../i18n';

export interface FeatureButtonProps {
  feature: FeatureDefinition;
  level: number;
  t: Translator;
  onActivate: (id: string) => void;
}

function statusText(feature: FeatureDefinition, level: number, t: Translator): string | null {
  if (feature.levels <= 1) return null;
  if (level <= 0) return t('level.off');
  const named = feature.levelLabelKeys?.[level - 1];
  return named ? t(named) : t('level.of', { current: level, total: feature.levels });
}

export function FeatureButton({ feature, level, t, onActivate }: FeatureButtonProps) {
  const active = level > 0;
  const multiLevel = feature.levels > 1;
  const status = statusText(feature, level, t);

  return (
    <button
      type="button"
      class="tile"
      data-feature={feature.id}
      aria-pressed={active}
      onClick={() => onActivate(feature.id)}
    >
      <span class="tile__label">{t(feature.labelKey)}</span>
      {status && <span class="tile__status">{status}</span>}
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
