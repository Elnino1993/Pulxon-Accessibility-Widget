import type { FeatureDefinition } from '../core/registry';

const ID = 'pause-animations';
const PAUSED_ATTR = 'data-pulxon-paused';

export const PAUSE_ANIMATIONS_CSS =
  '*:not([data-pulxon-ignore] *),*:not([data-pulxon-ignore] *)::before,*:not([data-pulxon-ignore] *)::after' +
  '{animation-duration:0.001ms!important;animation-delay:0s!important;' +
  'animation-iteration-count:1!important;transition-duration:0.001ms!important;' +
  'transition-delay:0s!important;scroll-behavior:auto!important}';

export const pauseAnimations: FeatureDefinition = {
  id: ID,
  group: 'distraction',
  labelKey: 'feature.pauseAnimations',
  levels: 1,
  apply: ({ doc, styles }) => {
    styles.set(ID, PAUSE_ANIMATIONS_CSS);
    for (const media of Array.from(doc.querySelectorAll('video'))) {
      if (!media.paused && !media.closest('[data-pulxon-ignore]')) {
        media.pause();
        media.setAttribute(PAUSED_ATTR, '');
      }
    }
  },
  teardown: ({ doc, styles }) => {
    styles.remove(ID);
    for (const media of Array.from(doc.querySelectorAll<HTMLVideoElement>(`video[${PAUSED_ATTR}]`))) {
      media.removeAttribute(PAUSED_ATTR);
      void media.play()?.catch(() => undefined);
    }
  },
};
