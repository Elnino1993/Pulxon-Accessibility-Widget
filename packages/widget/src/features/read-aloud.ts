import type { FeatureDefinition } from '../core/registry';
import { pick } from './shared';

const ID = 'read-aloud';
const READING_ATTR = 'data-pulxon-reading';

export const SPEECH_RATES = [1, 1.5, 0.75] as const;
export const MAX_SPOKEN_CHARS = 1000;
export const READABLE_SELECTOR =
  'p,li,h1,h2,h3,h4,h5,h6,td,th,dt,dd,blockquote,figcaption,caption,legend,label,button,a,summary';

export const READ_ALOUD_CSS =
  `[${READING_ATTR}]{outline:3px solid #ffbf00!important;outline-offset:2px!important;` +
  'background-color:rgba(255,191,0,0.25)!important}';

interface SpeechApi {
  synth: SpeechSynthesis;
  Utterance: typeof SpeechSynthesisUtterance;
}

interface State {
  rate: number;
  cleanup(): void;
}

const STATES = new WeakMap<Document, State>();

function speechApi(doc: Document): SpeechApi | null {
  const win = doc.defaultView;
  if (!win) return null;
  const synth = win.speechSynthesis as SpeechSynthesis | undefined;
  if (typeof synth?.speak !== 'function' || typeof win.SpeechSynthesisUtterance !== 'function') return null;
  return { synth, Utterance: win.SpeechSynthesisUtterance };
}

export function spokenText(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_SPOKEN_CHARS);
}

export const readAloud: FeatureDefinition = {
  id: ID,
  group: 'reading',
  labelKey: 'feature.readAloud',
  levels: SPEECH_RATES.length,
  levelLabelKeys: ['level.normal', 'level.fast', 'level.slow'],
  isSupported: (doc) => speechApi(doc) !== null,
  apply: ({ doc, styles }, level) => {
    const rate = pick(SPEECH_RATES, level);
    const existing = STATES.get(doc);
    if (existing) {
      existing.rate = rate;
      return;
    }
    const api = speechApi(doc);
    if (!api) return;
    styles.set(ID, READ_ALOUD_CSS);

    let current: Element | null = null;
    const state: State = { rate, cleanup: () => undefined };

    const clearMark = (): void => {
      current?.removeAttribute(READING_ATTR);
      current = null;
    };

    const speak = (el: Element): void => {
      const text = spokenText(el);
      if (!text) return;
      api.synth.cancel();
      clearMark();
      const utterance = new api.Utterance(text);
      utterance.rate = state.rate;
      utterance.lang = el.closest('[lang]')?.getAttribute('lang') || doc.documentElement.lang || 'en';
      utterance.onend = () => {
        if (current === el) clearMark();
      };
      current = el;
      el.setAttribute(READING_ATTR, '');
      api.synth.speak(utterance);
    };

    const readableTarget = (event: Event): Element | null => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== 'function' || target.closest('[data-pulxon-ignore]')) return null;
      return target.closest(READABLE_SELECTOR);
    };

    const onActivate = (event: Event): void => {
      const el = readableTarget(event);
      if (el) speak(el);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      api.synth.cancel();
      clearMark();
    };

    doc.addEventListener('click', onActivate, true);
    doc.addEventListener('focusin', onActivate);
    doc.addEventListener('keydown', onKeyDown);
    state.cleanup = () => {
      doc.removeEventListener('click', onActivate, true);
      doc.removeEventListener('focusin', onActivate);
      doc.removeEventListener('keydown', onKeyDown);
      api.synth.cancel();
      clearMark();
    };
    STATES.set(doc, state);
  },
  teardown: ({ doc, styles }) => {
    STATES.get(doc)?.cleanup();
    STATES.delete(doc);
    styles.remove(ID);
  },
};
