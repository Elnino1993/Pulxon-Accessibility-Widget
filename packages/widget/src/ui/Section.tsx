import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { Translator } from '../i18n';
import { UiIcon } from './icons';

export interface SectionProps {
  id: string;
  title: string;
  info: string;
  t: Translator;
  children: ComponentChildren;
}

/**
 * One card of the panel: an uppercase title, an ⓘ button, and its controls. The ⓘ opens a short
 * explanation in place rather than a hover tooltip, so it works the same by touch, keyboard and
 * screen reader.
 */
export function Section({ id, title, info, t, children }: SectionProps) {
  const [open, setOpen] = useState(false);
  const titleId = `pulxon-section-${id}`;
  const infoId = `pulxon-section-${id}-info`;
  return (
    <section class="card" data-pulxon-section={id} aria-labelledby={titleId}>
      <div class="card__head">
        <h3 id={titleId} class="card__title">
          {title}
        </h3>
        <button
          type="button"
          class="info-button"
          aria-label={t('section.about', { section: title })}
          aria-expanded={open}
          aria-controls={infoId}
          onClick={() => setOpen(!open)}
        >
          <UiIcon id="info" />
        </button>
      </div>
      <p id={infoId} class="card__info" hidden={!open}>
        {info}
      </p>
      {children}
    </section>
  );
}
