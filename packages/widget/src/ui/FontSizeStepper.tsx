import { TEXT_SCALES } from '../features/bigger-text';
import type { Translator } from '../i18n';
import { UiIcon } from './icons';

export interface FontSizeStepperProps {
  /** Bigger text's current level: 0 is off (100%), 1..n are TEXT_SCALES. */
  level: number;
  t: Translator;
  onChange: (level: number) => void;
}

/** 100% for off, then each of Bigger text's levels as the percentage it scales text to. */
export function percentFor(level: number): number {
  if (level <= 0) return 100;
  const scale = TEXT_SCALES[Math.min(level, TEXT_SCALES.length) - 1] ?? 1;
  return Math.round(scale * 100);
}

/**
 * Bigger text as − 100% +. At either end the button says so with `aria-disabled` instead of the
 * `disabled` attribute: a disabled button drops focus, and a keyboard user pressing + until the top
 * would suddenly find themselves back at the start of the page.
 */
export function FontSizeStepper({ level, t, onChange }: FontSizeStepperProps) {
  const max = TEXT_SCALES.length;
  const atMin = level <= 0;
  const atMax = level >= max;
  return (
    <div class="stepper" role="group" aria-labelledby="pulxon-font-size-label">
      <div id="pulxon-font-size-label" class="stepper__label">
        <UiIcon id="font-size" />
        {t('fontSize.label')}
      </div>
      <div class="stepper__row">
        <button
          type="button"
          class="stepper__button"
          data-pulxon-font-size="decrease"
          aria-label={t('fontSize.decrease')}
          aria-disabled={atMin}
          onClick={() => !atMin && onChange(level - 1)}
        >
          <UiIcon id="minus" />
        </button>
        <output class="stepper__value" aria-live="polite" data-pulxon-font-size-value>
          {percentFor(level)}%
        </output>
        <button
          type="button"
          class="stepper__button"
          data-pulxon-font-size="increase"
          aria-label={t('fontSize.increase')}
          aria-disabled={atMax}
          onClick={() => !atMax && onChange(level + 1)}
        >
          <UiIcon id="plus" />
        </button>
      </div>
    </div>
  );
}
