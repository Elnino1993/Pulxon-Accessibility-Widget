import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { matchCommand, voiceNavigation, VOICE_COMMANDS } from './voice-navigation';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  started = 0;
  stopped = 0;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
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

  it('scrolls when it hears a command', () => {
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const context = { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
    voiceNavigation.apply(context, 1);

    FakeRecognition.instances[0]?.onresult?.({ results: [[{ transcript: 'scroll down' }]] });
    expect(scroll).toHaveBeenCalled();

    voiceNavigation.teardown(context);
    scroll.mockRestore();
  });
});
