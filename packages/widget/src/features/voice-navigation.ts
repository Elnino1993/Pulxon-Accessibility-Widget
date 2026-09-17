import type { FeatureDefinition } from '../core/registry';

const ID = 'voice-navigation';

export interface VoiceCommand {
  id: string;
  /** Every phrase that triggers it; the first one is what the panel shows. */
  phrases: readonly string[];
}

export const VOICE_COMMANDS: readonly VoiceCommand[] = [
  { id: 'scroll-down', phrases: ['scroll down', 'page down'] },
  { id: 'scroll-up', phrases: ['scroll up', 'page up'] },
  { id: 'top', phrases: ['go to top', 'top of page'] },
  { id: 'bottom', phrases: ['go to bottom', 'bottom of page'] },
  { id: 'back', phrases: ['go back'] },
  { id: 'stop', phrases: ['stop listening'] },
] as const;

export function matchCommand(transcript: string): string | null {
  const said = transcript.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const command of VOICE_COMMANDS) {
    if (command.phrases.includes(said)) return command.id;
  }
  return null;
}

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

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
  isSupported: (doc) => recognitionCtor(doc) !== null,
  apply: ({ doc }) => {
    if (STATES.has(doc)) return;
    const Ctor = recognitionCtor(doc);
    if (!Ctor) return;

    const win = doc.defaultView;
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
        case 'stop':
          stopListening();
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
      const command = matchCommand(transcript);
      if (command) runCommand(command);
    };

    // The browser ends a recognition session after silence; restart it so "listening" stays on
    // until the visitor or teardown turns it off. A session that ends right after `stop()` (or
    // during teardown) must not spawn a new one, so both check `active` first.
    const startOne = (): void => {
      if (!active) return;
      const instance = new Ctor();
      instance.continuous = true;
      instance.interimResults = false;
      instance.onresult = onResult;
      instance.onend = () => {
        if (active) startOne();
      };
      instance.onerror = () => {
        // A denied microphone or a browser that refuses mid-session must not throw into the host
        // page and must not retry in a loop; treat it the same as the visitor saying "stop".
        stopListening();
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
