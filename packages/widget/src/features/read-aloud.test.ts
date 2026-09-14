import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { SPEECH_RATES, readAloud, spokenText } from './read-aloud';

class FakeUtterance {
  text: string;
  rate = 1;
  lang = '';
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

let speak = vi.fn();
let cancel = vi.fn();

function makeCtx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

function click(id: string): void {
  (document.getElementById(id) as HTMLElement).click();
}

function utterance(call: number): FakeUtterance {
  return speak.mock.calls[call]?.[0] as FakeUtterance;
}

beforeEach(() => {
  speak = vi.fn();
  cancel = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
});

afterEach(() => {
  readAloud.teardown(makeCtx());
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('lang');
});

describe('readAloud', () => {
  it('is only supported with the Web Speech API', () => {
    expect(readAloud.isSupported?.(document)).toBe(true);
    vi.stubGlobal('speechSynthesis', undefined);
    expect(readAloud.isSupported?.(document)).toBe(false);
  });

  it('exposes three named speeds', () => {
    expect(SPEECH_RATES).toEqual([1, 1.5, 0.75]);
    expect(readAloud.levelLabelKeys).toEqual(['level.normal', 'level.fast', 'level.slow']);
  });

  it('normalizes and caps spoken text', () => {
    const el = document.createElement('p');
    el.textContent = `  Hello \n  world ${'x'.repeat(2000)}`;
    expect(spokenText(el).startsWith('Hello world x')).toBe(true);
    expect(spokenText(el)).toHaveLength(1000);
  });

  it('reads the clicked text block at the selected rate and marks it while speaking', () => {
    document.documentElement.setAttribute('lang', 'en');
    document.body.innerHTML =
      '<p id="p">Hello <b id="b">big</b>\n world</p><p id="es" lang="es">Hola</p>' +
      '<div data-pulxon-ignore><p id="ignored">Widget</p></div>';
    const ctx = makeCtx();
    readAloud.apply(ctx, 1);

    click('b');
    expect(speak).toHaveBeenCalledOnce();
    expect(utterance(0)).toMatchObject({ text: 'Hello big world', rate: 1, lang: 'en' });
    const p = document.getElementById('p');
    expect(p?.hasAttribute('data-pulxon-reading')).toBe(true);
    utterance(0).onend?.();
    expect(p?.hasAttribute('data-pulxon-reading')).toBe(false);

    readAloud.apply(ctx, 2);
    click('es');
    expect(utterance(1)).toMatchObject({ text: 'Hola', rate: 1.5, lang: 'es' });

    click('ignored');
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('stops on Escape and cleans up on teardown', () => {
    document.body.innerHTML = '<p id="p">Hi</p>';
    const ctx = makeCtx();
    readAloud.apply(ctx, 1);
    click('p');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancel).toHaveBeenCalled();
    expect(document.getElementById('p')?.hasAttribute('data-pulxon-reading')).toBe(false);

    readAloud.teardown(ctx);
    speak.mockClear();
    click('p');
    expect(speak).not.toHaveBeenCalled();
    expect(document.head.querySelector('style[data-pulxon-style="read-aloud"]')).toBeNull();
  });

  it('does not restart speech when a focused element is then clicked', () => {
    let speaking = false;
    speak.mockImplementation(() => {
      speaking = true;
    });
    vi.stubGlobal('speechSynthesis', {
      speak,
      cancel,
      get speaking() {
        return speaking;
      },
    });
    document.body.innerHTML = '<button id="btn" type="button">Save</button>';
    readAloud.apply(makeCtx(), 1);
    const button = document.getElementById('btn') as HTMLButtonElement;
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    button.click();
    expect(speak).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('prefers an on-device voice for the utterance language and otherwise uses the default voice', () => {
    const online = { lang: 'es-ES', localService: false, name: 'Online' };
    const localEs = { lang: 'es-MX', localService: true, name: 'Local ES' };
    const localEn = { lang: 'en-US', localService: true, name: 'Local EN' };
    const getVoices = vi.fn(() => [online, localEn, localEs]);
    vi.stubGlobal('speechSynthesis', { speak, cancel, getVoices });
    document.body.innerHTML = '<p id="es" lang="es-ES">Hola</p><p id="fr" lang="fr">Bonjour</p>';
    readAloud.apply(makeCtx(), 1);

    click('es');
    expect((utterance(0) as FakeUtterance & { voice?: unknown }).voice).toBe(localEs);
    click('fr');
    expect((utterance(1) as FakeUtterance & { voice?: unknown }).voice).toBeUndefined();
  });

  it('clears the reading marker when speech fails', () => {
    document.body.innerHTML = '<p id="p">Hi</p>';
    readAloud.apply(makeCtx(), 1);
    click('p');
    const p = document.getElementById('p');
    expect(p?.hasAttribute('data-pulxon-reading')).toBe(true);
    utterance(0).onerror?.();
    expect(p?.hasAttribute('data-pulxon-reading')).toBe(false);
  });

  it('does not cancel speech it did not start', () => {
    document.body.innerHTML = '<p id="p">Hi</p>';
    const ctx = makeCtx();
    readAloud.apply(ctx, 1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    readAloud.teardown(ctx);
    expect(cancel).not.toHaveBeenCalled();
  });
});
