import type { FeatureDefinition } from '../core/registry';
import { widgetLang } from './shared';

const ID = 'voice-navigation';

export interface VoiceCommand {
  id: string;
  /** Every phrase that triggers it; the first one is what the panel shows. */
  phrases: readonly string[];
}

/** English commands, also the fallback table for a language the widget has no commands for. */
export const VOICE_COMMANDS: readonly VoiceCommand[] = [
  { id: 'scroll-down', phrases: ['scroll down', 'page down'] },
  { id: 'scroll-up', phrases: ['scroll up', 'page up'] },
  { id: 'top', phrases: ['go to top', 'top of page'] },
  { id: 'bottom', phrases: ['go to bottom', 'bottom of page'] },
  { id: 'back', phrases: ['go back'] },
] as const;

const VOICE_COMMANDS_ES: readonly VoiceCommand[] = [
  { id: 'scroll-down', phrases: ['bajar', 'desplazar hacia abajo', 'página abajo'] },
  { id: 'scroll-up', phrases: ['subir', 'desplazar hacia arriba', 'página arriba'] },
  { id: 'top', phrases: ['ir arriba', 'principio de la página'] },
  { id: 'bottom', phrases: ['ir abajo', 'final de la página'] },
  { id: 'back', phrases: ['volver', 'atrás'] },
] as const;

const COMMANDS_BY_LANG: Record<string, readonly VoiceCommand[]> = {
  en: VOICE_COMMANDS,
  es: VOICE_COMMANDS_ES,
};

/** The BCP-47 tag `SpeechRecognition.lang` is set to, per widget language. */
const RECOGNITION_LANG_TAGS: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
};

/** The command table for a widget language, falling back to the English one it has none for. */
export function voiceCommandsForLang(lang: string): readonly VoiceCommand[] {
  return COMMANDS_BY_LANG[lang] ?? VOICE_COMMANDS;
}

export function matchCommand(transcript: string, lang = 'en'): string | null {
  // Real speech recognizers commonly add trailing punctuation ("Scroll down.") that a plain phrase
  // table never contains; strip it before matching rather than growing every phrase list to cover it.
  const said = transcript.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?]+$/, '');
  for (const command of voiceCommandsForLang(lang)) {
    if (command.phrases.includes(said)) return command.id;
  }
  return null;
}

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

/** The subset of `SpeechRecognitionErrorEvent` this feature reads. */
interface RecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// Errors that mean the browser has decided to refuse and must not be retried: a denied or revoked
// permission, a browser policy blocking the service, or no microphone available. Every other error
// (e.g. 'no-speech', the browser's own silence timeout, or a transient 'network' failure) falls
// through to the normal end-of-session restart in `onend`.
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(doc: Document): SpeechRecognitionCtor | null {
  const win = doc.defaultView as (Window & Record<string, unknown>) | null;
  if (!win) return null;
  const ctor = (win.SpeechRecognition ?? win.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;
  return typeof ctor === 'function' ? ctor : null;
}

interface State {
  cleanup(): void;
}

const STATES = new WeakMap<Document, State>();

export const voiceNavigation: FeatureDefinition = {
  id: ID,
  group: 'navigation',
  labelKey: 'feature.voiceNavigation',
  levels: 1,
  // Starting the microphone again on page load, without the visitor asking, would break the
  // consent promise this feature was built around — see the field's doc comment in registry.ts.
  ephemeral: true,
  isSupported: (doc) => recognitionCtor(doc) !== null,
  apply: ({ doc }) => {
    if (STATES.has(doc)) return;
    const Ctor = recognitionCtor(doc);
    if (!Ctor) return;

    const win = doc.defaultView;
    // Read once per session: the widget's resolved language, and the command table and recognizer
    // language tag that go with it. Chrome (and every UA implementing the Web Speech API) transcribes
    // in whatever `lang` the recognizer is given, defaulting to the document's own language when it
    // is left unset — never the language the panel happens to be showing. Without setting it here, a
    // Spanish visitor's audio would be transcribed as English text that can never match a command.
    const lang = widgetLang(doc);
    const recognitionLang = RECOGNITION_LANG_TAGS[lang] ?? RECOGNITION_LANG_TAGS.en!;
    // Once teardown runs, no pending restart may fire a new recognizer against a dead feature.
    let active = true;
    let recognition: SpeechRecognitionLike | null = null;

    const stopListening = (): void => {
      active = false;
      recognition?.abort();
      recognition = null;
    };

    const runCommand = (id: string): void => {
      switch (id) {
        case 'scroll-down':
          win?.scrollBy(0, win.innerHeight * 0.8);
          break;
        case 'scroll-up':
          win?.scrollBy(0, -win.innerHeight * 0.8);
          break;
        case 'top':
          win?.scrollTo(0, 0);
          break;
        case 'bottom':
          win?.scrollTo(0, doc.documentElement.scrollHeight);
          break;
        case 'back':
          win?.history.back();
          break;
        default:
          break;
      }
    };

    const onResult = (event: RecognitionResultEvent): void => {
      const results = event.results;
      const last = results[results.length - 1];
      const transcript = last?.[last.length - 1]?.transcript;
      if (!transcript) return;
      const command = matchCommand(transcript, lang);
      if (command) runCommand(command);
    };

    // The browser ends a recognition session after silence; restart it so "listening" stays on
    // until the visitor or teardown turns it off. A session that ends right after `stopListening()`
    // (or during teardown) must not spawn a new one, so both check `active` first.
    const startOne = (): void => {
      if (!active) return;
      const instance = new Ctor();
      instance.continuous = true;
      instance.interimResults = false;
      instance.lang = recognitionLang;
      instance.onresult = onResult;
      instance.onend = () => {
        if (active) startOne();
      };
      instance.onerror = (event) => {
        // A fatal error (permission denied or revoked, browser policy, no microphone) must not
        // retry in a loop; stop for good. Anything else — most commonly 'no-speech', the browser's
        // own silence timeout, or a transient 'network' blip — is not fatal: leave `active` alone
        // and let the `end` event that follows restart the session as usual.
        if (FATAL_ERRORS.has(event.error)) stopListening();
      };
      recognition = instance;
      try {
        instance.start();
      } catch {
        // Synchronous throw: no microphone, permission denied, or a recognizer already running.
        recognition = null;
        active = false;
      }
    };

    startOne();

    STATES.set(doc, { cleanup: stopListening });
  },
  teardown: ({ doc }) => {
    STATES.get(doc)?.cleanup();
    STATES.delete(doc);
  },
};
