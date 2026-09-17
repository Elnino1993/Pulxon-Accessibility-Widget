import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createController } from '../core/controller';
import { createRegistry } from '../core/registry';
import { createMemoryStorage } from '../core/storage';
import { SETTINGS_KEY, createSettingsStore } from '../core/store';
import { createStyleEngine } from '../core/style-engine';
import { matchCommand, voiceCommandsForLang, voiceNavigation, VOICE_COMMANDS } from './voice-navigation';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  started = 0;
  stopped = 0;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started += 1;
  }
  stop() {
    this.stopped += 1;
  }
  abort() {
    this.stopped += 1;
  }
}

beforeEach(() => {
  FakeRecognition.instances = [];
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
});

afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  document.body.innerHTML = '';
});

describe('matchCommand', () => {
  it('matches a command however it is spaced or cased', () => {
    expect(matchCommand('  Scroll   DOWN ')).toBe('scroll-down');
    expect(matchCommand('go to top')).toBe('top');
  });

  it('returns null for anything else', () => {
    expect(matchCommand('order me a pizza')).toBeNull();
  });

  it('documents every command it can match', () => {
    for (const command of VOICE_COMMANDS) {
      expect(matchCommand(command.phrases[0]!)).toBe(command.id);
    }
  });

  it('matches the Spanish table when told to, and does not match Spanish phrases in the English table', () => {
    for (const command of voiceCommandsForLang('es')) {
      expect(matchCommand(command.phrases[0]!, 'es')).toBe(command.id);
    }
    expect(matchCommand('bajar', 'en')).toBeNull();
    expect(matchCommand('scroll down', 'es')).toBeNull();
  });

  it('falls back to the English table for a language the widget has no commands for', () => {
    expect(matchCommand('scroll down', 'fr')).toBe('scroll-down');
  });
});

describe('voiceNavigation', () => {
  it('is hidden where the browser has no speech recognition', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    expect(voiceNavigation.isSupported?.(document)).toBe(false);
  });

  it('starts listening only when it is turned on', () => {
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    expect(FakeRecognition.instances).toHaveLength(0);

    voiceNavigation.apply(context, 1);
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(FakeRecognition.instances[0]?.started).toBe(1);

    voiceNavigation.teardown(context);
    expect(FakeRecognition.instances[0]?.stopped).toBeGreaterThan(0);
  });

  it('sets the recognizer language from the widget language, defaulting to English', () => {
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    voiceNavigation.apply(context, 1);
    expect(FakeRecognition.instances[0]?.lang).toBe('en-US');
    voiceNavigation.teardown(context);
  });

  it('matches a Spanish phrase and sets the recognizer language on a Spanish widget', () => {
    // `dictionary.ts` reads the widget's resolved language the same way, from the
    // `data-pulxon-lang` attribute `mountUI` sets on the (light-DOM) host.
    const host = document.createElement('div');
    host.setAttribute('data-pulxon-lang', 'es');
    document.body.append(host);

    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    voiceNavigation.apply(context, 1);

    expect(FakeRecognition.instances[0]?.lang).toBe('es-ES');
    FakeRecognition.instances[0]?.onresult?.({ results: [[{ transcript: 'bajar' }]] });
    expect(scroll).toHaveBeenCalled();

    voiceNavigation.teardown(context);
    scroll.mockRestore();
  });

  it('scrolls when it hears a command', () => {
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    voiceNavigation.apply(context, 1);

    FakeRecognition.instances[0]?.onresult?.({ results: [[{ transcript: 'scroll down' }]] });
    expect(scroll).toHaveBeenCalled();

    voiceNavigation.teardown(context);
    scroll.mockRestore();
  });

  it('restarts a new session when one ends while the feature is still on', () => {
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    voiceNavigation.apply(context, 1);
    expect(FakeRecognition.instances).toHaveLength(1);

    // The browser ends a continuous session on its own (most commonly after silence); the feature
    // must restart listening rather than going dead after the first pause.
    FakeRecognition.instances[0]?.onend?.();
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(FakeRecognition.instances[1]?.started).toBe(1);

    voiceNavigation.teardown(context);
  });

  it('does not restart once teardown has aborted the session, even if onend still fires', () => {
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    voiceNavigation.apply(context, 1);
    const first = FakeRecognition.instances[0]!;

    voiceNavigation.teardown(context);
    expect(first.stopped).toBeGreaterThan(0);

    // `abort()` fires the aborted instance's own `onend` asynchronously in real browsers; that
    // race must not spawn a new recognizer after teardown has already run.
    first.onend?.();
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('stops for good on a fatal error and does not retry', () => {
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    voiceNavigation.apply(context, 1);
    const first = FakeRecognition.instances[0]!;

    first.onerror?.({ error: 'not-allowed' });
    expect(first.stopped).toBeGreaterThan(0);

    // The `end` event that follows a fatal error must not be treated as an ordinary silence
    // timeout and restarted.
    first.onend?.();
    expect(FakeRecognition.instances).toHaveLength(1);

    voiceNavigation.teardown(context);
  });

  it('restarts after a non-fatal error such as no-speech', () => {
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    voiceNavigation.apply(context, 1);
    const first = FakeRecognition.instances[0]!;

    first.onerror?.({ error: 'no-speech' });
    expect(first.stopped).toBe(0);
    first.onend?.();
    expect(FakeRecognition.instances).toHaveLength(2);

    voiceNavigation.teardown(context);
  });
});

describe('voiceNavigation through the controller (applyAll on page load)', () => {
  it('never resumes the microphone on a reload, even though the level is already stored', () => {
    const storage = createMemoryStorage();
    storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: { 'voice-navigation': 1 }, profile: null, lang: null }));
    const store = createSettingsStore(storage);
    const registry = createRegistry([voiceNavigation]);
    const ctx = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    const controller = createController({ registry, store, ctx, profiles: [] });

    controller.applyAll();

    expect(FakeRecognition.instances).toHaveLength(0);
    expect(controller.level('voice-navigation')).toBe(0);
    expect(store.get().features).toEqual({});
  });
});
