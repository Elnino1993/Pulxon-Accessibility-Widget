import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveOptions, type WidgetOptions } from '../config/options';
import { createController } from '../core/controller';
import { createRegistry, type FeatureDefinition, type ProfileDefinition } from '../core/registry';
import { createMemoryStorage } from '../core/storage';
import { createSettingsStore } from '../core/store';
import { createStyleEngine } from '../core/style-engine';
import { dictionary, highlightLinks, pauseAnimations, voiceNavigation } from '../features';
import { VOICE_COMMANDS } from '../features/voice-navigation';
import { createTranslator } from '../i18n';
import { mountUI, type UiHandle } from './mount';

const handles: UiHandle[] = [];

const lowVision: ProfileDefinition = {
  id: 'low-vision',
  labelKey: 'profile.lowVision',
  features: { 'bigger-text': 2 },
};

function setup(
  features: FeatureDefinition[] = [highlightLinks, pauseAnimations],
  profiles: ProfileDefinition[] = [],
  options: Partial<WidgetOptions> = {},
) {
  const store = createSettingsStore(createMemoryStorage());
  const registry = createRegistry(features);
  const styles = createStyleEngine(document, { mode: 'style-tag' });
  const controller = createController({ registry, store, ctx: { doc: document, styles }, profiles });
  const holder: { ui?: UiHandle } = {};
  act(() => {
    holder.ui = mountUI({
      doc: document,
      options: resolveOptions({}, options),
      controller,
      registry,
      store,
      profiles,
      t: createTranslator('en'),
      styleMode: 'style-tag',
    });
  });
  const ui = holder.ui;
  if (!ui) throw new Error('mount failed');
  handles.push(ui);
  const root = ui.host.shadowRoot;
  if (!root) throw new Error('missing shadow root');
  act(() => ui.open());
  return { ui, host: ui.host, root, controller, store };
}

function buttonByText(root: ShadowRoot, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
}

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('Panel', () => {
  it('renders an accessible dialog with grouped feature tiles', () => {
    const { root } = setup();
    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog?.id).toBe('pulxon-panel');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('pulxon-title');
    expect(root.querySelector('#pulxon-title')?.textContent).toBe('Accessibility');
    expect(Array.from(root.querySelectorAll('h3')).map((h) => h.textContent)).toEqual(['Navigation', 'Distractions']);
    expect(root.querySelectorAll('[data-feature]')).toHaveLength(2);
    expect(root.querySelector('[aria-label="Close accessibility menu"]')).not.toBeNull();
  });

  it('toggles a feature from its tile', () => {
    const { root, controller } = setup();
    const tile = () => root.querySelector<HTMLButtonElement>('[data-feature="highlight-links"]');
    expect(tile()?.getAttribute('aria-pressed')).toBe('false');
    act(() => tile()?.click());
    expect(controller.level('highlight-links')).toBe(1);
    expect(tile()?.getAttribute('aria-pressed')).toBe('true');
    expect(document.head.querySelector('style[data-pulxon-style="highlight-links"]')).not.toBeNull();
  });

  it('shows level status for multi-level features', () => {
    const multi: FeatureDefinition = {
      id: 'multi',
      group: 'text',
      labelKey: 'feature.highlightLinks',
      levels: 3,
      apply: vi.fn(),
      teardown: vi.fn(),
    };
    const { root, controller } = setup([multi]);
    const status = () => root.querySelector('[data-feature="multi"] .tile__status')?.textContent;
    expect(status()).toBe('Off');
    act(() => {
      controller.enable('multi', 2);
    });
    expect(status()).toBe('Level 2 of 3');
    expect(root.querySelectorAll('[data-feature="multi"] .dot--on')).toHaveLength(2);
  });

  it('closes on Escape and via the close button', () => {
    const { ui, root } = setup();
    const dialog = root.querySelector('[role="dialog"]') as HTMLElement;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(ui.isOpen()).toBe(false);
    expect(root.querySelector('[role="dialog"]')).toBeNull();

    act(() => ui.open());
    act(() => root.querySelector<HTMLButtonElement>('[aria-label="Close accessibility menu"]')?.click());
    expect(ui.isOpen()).toBe(false);
  });

  it('reset clears all features', () => {
    const { root, store } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-feature="pause-animations"]')?.click());
    expect(store.get().features).toEqual({ 'pause-animations': 1 });
    act(() => buttonByText(root, 'Reset page adjustments')?.click());
    expect(store.get().features).toEqual({});
    expect(root.querySelector('[data-feature="pause-animations"]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders profiles and toggles them', () => {
    const profile: ProfileDefinition = {
      id: 'calm',
      labelKey: 'feature.pauseAnimations',
      features: { 'pause-animations': 1 },
    };
    const { root, store } = setup([highlightLinks, pauseAnimations], [profile]);
    expect(root.querySelector('#pulxon-profiles')?.textContent).toBe('Profiles');
    const profileButton = () => root.querySelector<HTMLButtonElement>('[data-profile="calm"]');
    act(() => profileButton()?.click());
    expect(store.get().profile).toBe('calm');
    expect(profileButton()?.getAttribute('aria-pressed')).toBe('true');
    act(() => profileButton()?.click());
    expect(store.get()).toMatchObject({ profile: null, features: {} });
  });

  it('shows named level labels when a feature provides them', () => {
    const aligned: FeatureDefinition = {
      id: 'aligned',
      group: 'text',
      labelKey: 'feature.textAlign',
      levels: 2,
      levelLabelKeys: ['level.left', 'level.right'],
      apply: vi.fn(),
      teardown: vi.fn(),
    };
    const { root, controller } = setup([aligned]);
    act(() => {
      controller.enable('aligned', 2);
    });
    expect(root.querySelector('[data-feature="aligned"] .tile__status')?.textContent).toBe('Right');
  });

  it('hides features that are not supported in this environment', () => {
    const unsupported: FeatureDefinition = {
      id: 'nope',
      group: 'reading',
      labelKey: 'feature.readAloud',
      levels: 1,
      isSupported: () => false,
      apply: vi.fn(),
      teardown: vi.fn(),
    };
    const { root } = setup([highlightLinks, unsupported]);
    expect(root.querySelector('[data-feature="nope"]')).toBeNull();
    expect(root.querySelector('[data-feature="highlight-links"]')).not.toBeNull();
  });
});

describe('Page structure view', () => {
  it('lists headings, moves focus to the chosen heading and closes the panel', () => {
    document.body.insertAdjacentHTML('afterbegin', '<main><h1 id="top">Fixture title</h1><h2>Section</h2></main>');
    const { ui, root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());

    expect(root.querySelector('#pulxon-tab-headings')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('pulxon-tab-headings');
    const item = Array.from(root.querySelectorAll<HTMLButtonElement>('.structure__item')).find((button) =>
      button.textContent?.includes('Fixture title'),
    );
    expect(item).toBeDefined();

    act(() => item?.click());
    const heading = document.getElementById('top');
    expect(ui.isOpen()).toBe(false);
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute('tabindex')).toBe('-1');
  });

  it('switches tabs with arrow keys and returns to the settings view', () => {
    document.body.insertAdjacentHTML('afterbegin', '<nav aria-label="Primary"><a href="#a">Home link</a></nav>');
    const { root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());

    act(() => {
      root
        .querySelector('#pulxon-tab-headings')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    expect(root.querySelector('#pulxon-tab-landmarks')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('#pulxon-tab-headings')?.getAttribute('tabindex')).toBe('-1');
    expect(root.querySelector('.structure__list')?.textContent).toContain('Navigation');
    expect(root.querySelector('.structure__list')?.textContent).toContain('Primary');

    act(() => root.querySelector<HTMLButtonElement>('.back')?.click());
    const tool = root.querySelector('[data-tool="page-structure"]');
    expect(tool).not.toBeNull();
    expect(root.activeElement).toBe(tool);
  });

  it('closes and returns focus to the launcher when the target was removed from the DOM', () => {
    document.body.insertAdjacentHTML('afterbegin', '<main><h1 id="top">Fixture title</h1></main>');
    const { ui, root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());
    const item = Array.from(root.querySelectorAll<HTMLButtonElement>('.structure__item')).find((button) =>
      button.textContent?.includes('Fixture title'),
    );
    document.getElementById('top')?.remove();

    act(() => item?.click());
    expect(ui.isOpen()).toBe(false);
    expect(root.activeElement).toBe(root.querySelector('.launcher'));
  });

  it('closes and returns focus to the launcher when a connected target cannot take focus', () => {
    document.body.insertAdjacentHTML('afterbegin', '<main><h1 id="top">Fixture title</h1></main>');
    const { ui, root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());
    const item = Array.from(root.querySelectorAll<HTMLButtonElement>('.structure__item')).find((button) =>
      button.textContent?.includes('Fixture title'),
    );
    const heading = document.getElementById('top') as HTMLElement;
    vi.spyOn(heading, 'focus').mockImplementation(() => undefined);

    act(() => item?.click());
    expect(ui.isOpen()).toBe(false);
    expect(root.activeElement).toBe(root.querySelector('.launcher'));
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });

  it('makes an empty tabpanel focusable when there is nothing to list', () => {
    const { root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());
    act(() => {
      root
        .querySelector('#pulxon-tab-headings')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    });
    expect(root.querySelector('#pulxon-tab-links')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[role="tabpanel"]')?.getAttribute('tabindex')).toBe('0');
  });

  it('shows the link label before its href detail', () => {
    document.body.insertAdjacentHTML('afterbegin', '<a href="/about">About us</a>');
    const { root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());
    act(() => {
      root
        .querySelector('#pulxon-tab-headings')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    });
    const item = root.querySelector<HTMLButtonElement>('.structure__item');
    expect(item?.firstElementChild?.className).toBe('structure__label');
    expect(item?.firstElementChild?.textContent).toBe('About us');
  });

  it('Home and End move to the first and last tab and focus it', () => {
    const { root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());
    act(() => {
      root
        .querySelector('#pulxon-tab-headings')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    });
    expect(root.querySelector('#pulxon-tab-links')?.getAttribute('aria-selected')).toBe('true');
    expect(root.activeElement).toBe(root.querySelector('#pulxon-tab-links'));

    act(() => {
      root
        .querySelector('#pulxon-tab-links')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    });
    expect(root.querySelector('#pulxon-tab-headings')?.getAttribute('aria-selected')).toBe('true');
    expect(root.activeElement).toBe(root.querySelector('#pulxon-tab-headings'));
  });

  it('focuses the Back button when the structure view opens', () => {
    const { root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());
    expect(root.activeElement).toBe(root.querySelector('.back'));
  });

  it('Escape from the structure view closes the panel and returns focus to the launcher', () => {
    const { ui, root } = setup();
    act(() => root.querySelector<HTMLButtonElement>('[data-tool="page-structure"]')?.click());
    const dialog = root.querySelector('[role="dialog"]') as HTMLElement;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(ui.isOpen()).toBe(false);
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(root.activeElement).toBe(root.querySelector('.launcher'));
  });
});

describe('Panel chrome', () => {
  it('names the active profile above the tiles', async () => {
    const { host, controller } = setup([highlightLinks], [lowVision]);
    await act(async () => {
      controller.setProfile('low-vision');
    });
    const row = host.shadowRoot!.querySelector('[data-pulxon-active-profile]');
    expect(row?.textContent).toContain('Low vision');
  });

  it('says nothing about a profile when none is active', () => {
    const { host } = setup([highlightLinks], [lowVision]);
    expect(host.shadowRoot!.querySelector('[data-pulxon-active-profile]')).toBeNull();
  });

  it('explains where voice navigation sends what you say, lists the commands, and describes the tile for screen readers', () => {
    // `voiceNavigation.isSupported` gates on a `SpeechRecognition` constructor, which this test
    // environment does not provide by default; stub the minimum shape so the tile (and its note)
    // survive `mountUI`'s support filter, the same way voice-navigation.test.ts does.
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {}
      stop() {}
      abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
    try {
      const { host } = setup([voiceNavigation], []);
      const note = host.shadowRoot!.querySelector('[data-pulxon-voice-note]');
      expect(note?.textContent).toContain('speech service');
      expect(note?.id).toBeTruthy();

      // A visitor who turns the tile on needs to see what to say; the panel renders every command's
      // display phrase as a list under the note.
      const list = host.shadowRoot!.querySelector('[data-pulxon-voice-commands]');
      expect(list).not.toBeNull();
      const items = [...list!.querySelectorAll('li')].map((li) => li.textContent);
      for (const command of VOICE_COMMANDS) {
        expect(items).toContain(command.phrases[0]);
      }

      // A screen-reader visitor on the tile itself must hear the privacy note, not just a visitor
      // who happens to read the paragraph below the whole group.
      const tile = host.shadowRoot!.querySelector('[data-feature="voice-navigation"]');
      expect(tile?.getAttribute('aria-describedby')).toBe(note?.id);
    } finally {
      delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    }
  });

  it('explains where the dictionary link sends the visitor and describes the tile for screen readers', () => {
    const { host } = setup([dictionary], []);
    const note = host.shadowRoot!.querySelector('[data-pulxon-dictionary-note]');
    expect(note?.textContent).toContain('Wiktionary');
    expect(note?.id).toBeTruthy();

    const tile = host.shadowRoot!.querySelector('[data-feature="dictionary"]');
    expect(tile?.getAttribute('aria-describedby')).toBe(note?.id);
  });

  it('links to the accessibility statement when the site gives one', () => {
    const { host } = setup([highlightLinks], [], { statementUrl: 'https://example.com/accessibility' });
    const link = host.shadowRoot!.querySelector<HTMLAnchorElement>('[data-pulxon-statement]');
    expect(link?.href).toBe('https://example.com/accessibility');
    expect(link?.target).toBe('_blank');
  });

  it('shows no statement link when the site gives none', () => {
    const { host } = setup([highlightLinks], []);
    expect(host.shadowRoot!.querySelector('[data-pulxon-statement]')).toBeNull();
  });
});
