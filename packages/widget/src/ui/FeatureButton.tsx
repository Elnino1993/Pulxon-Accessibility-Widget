import type { FeatureDefinition } from '../core/registry';
import type { Translator } from '../i18n';

export interface FeatureButtonProps {
  feature: FeatureDefinition;
  level: number;
  t: Translator;
  onActivate: (id: string) => void;
}

export function FeatureButton({ feature, level, t, onActivate }: FeatureButtonProps) {
  const active = level > 0;
  const multiLevel = feature.levels > 1;
  const status = multiLevel
    ? active
      ? t('level.of', { current: level, total: feature.levels })
      : t('level.off')
    : null;

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
