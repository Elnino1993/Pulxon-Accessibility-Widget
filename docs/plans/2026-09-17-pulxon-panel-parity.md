# Panel Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between our panel and the reference widget's: add tooltips, a dictionary lookup, voice navigation, an in-panel language picker, an oversized-widget toggle, a way to move the launcher, a link to the site's accessibility statement, and a row naming the active profile.

**Architecture:** Three of these are ordinary features and slot straight into the existing registry (`tooltips`, `dictionary`, `voice-navigation`). The rest are panel chrome, which means the settings the user picks in the panel must outlive a reload: `Settings` grows `ui` (`scale`, `position`) alongside the existing `lang`, and the widget re-reads them when the store changes, so a moved or enlarged widget stays that way. Two features reach outside the page — voice navigation streams microphone audio to the browser's speech service, and a definition has to be looked up somewhere — so both are gated behind an explicit, plainly worded consent and neither makes a background request.

**Tech Stack:** TypeScript strict, Preact in a shadow root, Vite 8, Vitest 5, Playwright 1.63, size-limit (40 kB gzip budget).

## Global Constraints

- Branch: `feat/panel-parity`, from widget `main` (head `392582b`'s widget-side counterpart `8d1a4f1`). One commit per task, conventional-commit subject, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` as a separate `-m`.
- Repo-local git identity is `Pulxon` / `dev@pulxon.com`. Never use a personal email in a commit.
- **The widget must keep making no third-party requests on its own.** The README promises it, and the two outward-facing features here must not break that promise: voice navigation only starts after the visitor turns it on and reads what it says about the browser's speech service, and the dictionary never fetches — it opens a lookup in a new tab when the visitor asks for one.
- **Accessibility is the product.** Every control is reachable by keyboard, has a visible focus ring, and carries an accessible name. State is never signalled by color alone. Contrast ≥ 4.5:1 for text and ≥ 3:1 for control borders against the panel's `#f4f6fb` and the tiles' `#ffffff`.
- No compliance or legal claims in any copy: never say or imply ADA, FTC, lawsuit risk, "compliant", "certified", or a risk score. The widget does not make a site accessible; it lets a visitor adjust it.
- Every user-facing string goes through `t()` with a key added to **both** `src/i18n/locales/en.ts` and `src/i18n/locales/es.ts`. The i18n test asserts the two locales have identical key sets.
- Size budget: `pnpm --filter @pulxon/widget size` must stay under 40 kB gzip (23.71 kB before this plan). Report the size in every task that changes the bundle.
- Verification per task, from `widget/`, in the foreground: `pnpm --filter @pulxon/widget test`, `lint`, `typecheck`, `build`, `size`; the tasks that say so also run `e2e`. Never run two builds at once and never start a dev server.

---

## File structure

**New features** (`packages/widget/src/features/`)
- `tooltips.ts` — shows an element's own accessible name on hover and focus.
- `dictionary.ts` — offers a lookup for the visitor's current selection.
- `voice-navigation.ts` — speech commands, behind consent.

**Panel chrome** (`packages/widget/src/ui/`)
- `PanelSettings.tsx` — the language picker, the size toggle and the move-widget control, as one block under the header.
- `Panel.tsx` — renders that block, the active-profile row and the statement link.
- `icons.tsx` — icons for the three new features and the chrome rows.
- `styles.css` — the rows, the segmented controls and the consent note.

**State** (`packages/widget/src/core/`)
- `store.ts` — `Settings.ui: { scale: 'normal' | 'large'; position: Position | null }`, defaulted and migrated.

**Config** (`packages/widget/src/config/`)
- `options.ts` — `statementUrl: string | null` from `data-statement-url`, and the same field in the remote config contract.

---

### Task 1: Settings remember the panel's own choices

**Files:**
- Modify: `packages/widget/src/core/store.ts`
- Test: `packages/widget/src/core/store.test.ts`

**Interfaces:**
- Produces: `Settings.ui: WidgetUiSettings` where `interface WidgetUiSettings { scale: 'normal' | 'large'; position: Position | null }`, exported from `store.ts`. `position: null` means "whatever the embed code chose". Later tasks read and write it through the existing `store.update`.

- [ ] **Step 1: Write the failing test**

Add to `packages/widget/src/core/store.test.ts`:

```ts
it('defaults the ui settings and keeps them across a reload', () => {
  const storage = createMemoryStorage();
  const store = createSettingsStore(storage);
  expect(store.get().ui).toEqual({ scale: 'normal', position: null });

  store.update((settings) => ({ ...settings, ui: { scale: 'large', position: 'bottom-left' } }));
  expect(createSettingsStore(storage).get().ui).toEqual({ scale: 'large', position: 'bottom-left' });
});

it('ignores a stored ui object with unknown values', () => {
  const storage = createMemoryStorage();
  storage.set(SETTINGS_KEY, JSON.stringify({ v: 1, features: {}, profile: null, lang: null, ui: { scale: 'huge', position: 'orbit' } }));
  expect(createSettingsStore(storage).get().ui).toEqual({ scale: 'normal', position: null });
});
```

Import `SETTINGS_KEY` and `createMemoryStorage` the way the file already does.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @pulxon/widget test -- -t "ui settings"`
Expected: FAIL — `ui` is undefined.

- [ ] **Step 3: Add the field**

In `store.ts`, above `Settings`:

```ts
export type WidgetScale = 'normal' | 'large';

export interface WidgetUiSettings {
  scale: WidgetScale;
  /** null means "keep whatever the embed code chose". */
  position: Position | null;
}

export const DEFAULT_UI_SETTINGS: WidgetUiSettings = Object.freeze({ scale: 'normal', position: null });
```

Add `ui: WidgetUiSettings;` to `Settings`, `ui: DEFAULT_UI_SETTINGS` to `EMPTY_SETTINGS`, and parse it in the existing `parseSettings` with the same defensive style the file already uses for `features` and `lang`: accept `scale` only when it is `'normal'` or `'large'`, accept `position` only when `isPosition(value)` says so, and fall back to `DEFAULT_UI_SETTINGS` otherwise. Import `isPosition` and the `Position` type from `../config/options`.

- [ ] **Step 4: Run the store tests**

Run: `pnpm --filter @pulxon/widget test -- store`
Expected: PASS.

- [ ] **Step 5: Fix the fallout and commit**

`pnpm --filter @pulxon/widget typecheck` will list every place that builds a `Settings` literal (tests and fixtures). Add `ui: DEFAULT_UI_SETTINGS` to each; change no assertions.

```bash
git add packages/widget/src
git commit -m "feat(widget): remember the panel's own settings" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Tooltips

**Files:**
- Create: `packages/widget/src/features/tooltips.ts`
- Modify: `packages/widget/src/features/index.ts`, `packages/widget/src/ui/icons.tsx`, `packages/widget/src/i18n/locales/en.ts`, `packages/widget/src/i18n/locales/es.ts`
- Test: `packages/widget/src/features/tooltips.test.ts`

**Interfaces:**
- Produces: `export const tooltips: FeatureDefinition` with `id: 'tooltips'`, `group: 'navigation'`, `levels: 1`, added to `builtinFeatures`.

- [ ] **Step 1: Write the failing test**

Create `packages/widget/src/features/tooltips.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { tooltips } from './tooltips';

function ctx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('tooltips', () => {
  it('shows an element’s accessible name on focus', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Add to cart');
    document.body.append(button);
    const context = ctx();
    tooltips.apply(context, 1);

    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const tip = document.querySelector('[data-pulxon-tooltip]');
    expect(tip?.textContent).toBe('Add to cart');
    tooltips.teardown(context);
  });

  it('prefers the title, then aria-label, then the alt text', () => {
    const image = document.createElement('img');
    image.alt = 'A red bicycle';
    document.body.append(image);
    const context = ctx();
    tooltips.apply(context, 1);

    image.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')?.textContent).toBe('A red bicycle');

    image.title = 'Bicycle, 2024 model';
    image.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')?.textContent).toBe('Bicycle, 2024 model');
    tooltips.teardown(context);
  });

  it('shows nothing for an element without a name', () => {
    const div = document.createElement('div');
    document.body.append(div);
    const context = ctx();
    tooltips.apply(context, 1);

    div.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();
    tooltips.teardown(context);
  });

  it('removes the tooltip and its listeners on teardown', () => {
    const button = document.createElement('button');
    button.title = 'Save';
    document.body.append(button);
    const context = ctx();
    tooltips.apply(context, 1);
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).not.toBeNull();

    tooltips.teardown(context);
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector('[data-pulxon-tooltip]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @pulxon/widget test -- tooltips`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

Create `packages/widget/src/features/tooltips.ts`. Read `packages/widget/src/features/highlight-links.ts` first and follow its shape exactly — the same `FeatureDefinition` object, the same way of adding and removing document listeners, the same guard against running twice.

Behavior:
- On `mouseover` and `focusin`, walk up from the target with `closest` to the nearest element carrying a name: `title`, then `aria-label`, then `alt` on an `img`. Take the first non-empty, trimmed value.
- Render one `div` with `data-pulxon-tooltip` appended to `doc.body`, positioned next to the element with `getBoundingClientRect` plus the page's scroll offsets, `position: absolute`, `z-index` one below the widget's own.
- Give it `role="tooltip"` and `aria-hidden="true"`: the name it repeats is already announced by assistive technology, so this is for sighted visitors and must not double-announce.
- Hide it on `mouseout`, `focusout`, `Escape` and `scroll`.
- Style it through the style engine, in the same way `highlight-links` injects its CSS: dark background `#111111`, `#ffffff` text (contrast 18:1), 4px radius, 6px 8px padding, `max-width: 280px`, `pointer-events: none`.
- Never copy the element's inner HTML — only the attribute text, inserted with `textContent`.

- [ ] **Step 4: Register and name it**

Add `tooltips` to `builtinFeatures` in `features/index.ts` (after `highlightLinks`), add `'feature.tooltips': 'Tooltips'` to `en.ts` and `'feature.tooltips': 'Descripciones'` to `es.ts`, and add a `tooltips` icon to `icons.tsx` — a speech bubble: `<path d="M4 5h16v11H9l-4 4z" />`.

- [ ] **Step 5: Verify and commit**

Run `pnpm --filter @pulxon/widget test`, `lint`, `typecheck`, `build`, `size`. All exit 0; report the size.

```bash
git add packages/widget/src
git commit -m "feat(widget): show an element's own name as a tooltip" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Dictionary lookup

**Files:**
- Create: `packages/widget/src/features/dictionary.ts`
- Modify: `packages/widget/src/features/index.ts`, `packages/widget/src/ui/icons.tsx`, both locale files
- Test: `packages/widget/src/features/dictionary.test.ts`

**Interfaces:**
- Produces: `export const dictionary: FeatureDefinition` with `id: 'dictionary'`, `group: 'reading'`, `levels: 1`.

- [ ] **Step 1: Write the failing test**

Create `packages/widget/src/features/dictionary.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { dictionary, lookupUrl } from './dictionary';

function ctx() {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }) };
}

function select(text: string) {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  document.body.append(paragraph);
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('lookupUrl', () => {
  it('points at the Wiktionary entry for the word', () => {
    expect(lookupUrl('bicycle', 'en')).toBe('https://en.wiktionary.org/wiki/bicycle');
  });

  it('encodes the word and drops surrounding punctuation', () => {
    expect(lookupUrl('  "caffè".  ', 'en')).toBe('https://en.wiktionary.org/wiki/caff%C3%A8');
  });

  it('uses the widget language for the wiki subdomain, falling back to English', () => {
    expect(lookupUrl('bici', 'es')).toBe('https://es.wiktionary.org/wiki/bici');
    expect(lookupUrl('bici', 'zz-not-a-lang')).toBe('https://en.wiktionary.org/wiki/bici');
  });

  it('returns null when the selection is not a single word', () => {
    expect(lookupUrl('a whole sentence here', 'en')).toBeNull();
    expect(lookupUrl('   ', 'en')).toBeNull();
  });
});

describe('dictionary', () => {
  it('offers a lookup button once a word is selected', () => {
    const context = ctx();
    dictionary.apply(context, 1);
    select('bicycle');

    const button = document.querySelector<HTMLAnchorElement>('[data-pulxon-dictionary]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('href')).toBe('https://en.wiktionary.org/wiki/bicycle');
    expect(button?.getAttribute('target')).toBe('_blank');
    expect(button?.getAttribute('rel')).toBe('noopener noreferrer');
    dictionary.teardown(context);
  });

  it('makes no request of its own', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const context = ctx();
    dictionary.apply(context, 1);
    select('bicycle');
    expect(fetchSpy).not.toHaveBeenCalled();
    dictionary.teardown(context);
    fetchSpy.mockRestore();
  });

  it('removes the button on teardown', () => {
    const context = ctx();
    dictionary.apply(context, 1);
    select('bicycle');
    dictionary.teardown(context);
    expect(document.querySelector('[data-pulxon-dictionary]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @pulxon/widget test -- dictionary`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

Create `packages/widget/src/features/dictionary.ts` with:

```ts
const WORD = /^[\p{L}\p{M}'-]{1,40}$/u;
const WIKI_LANG = /^[a-z]{2,3}$/;

/** The Wiktionary entry for a single selected word, or null when the selection is not one word. */
export function lookupUrl(selection: string, lang: string): string | null {
  const word = selection.trim().replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '');
  if (!WORD.test(word)) return null;
  const subdomain = WIKI_LANG.test(lang.split('-')[0] ?? '') ? lang.split('-')[0] : 'en';
  return `https://${subdomain}.wiktionary.org/wiki/${encodeURIComponent(word)}`;
}
```

The feature itself listens for `selectionchange` on the document; when `lookupUrl` returns a URL it renders a single `<a data-pulxon-dictionary target="_blank" rel="noopener noreferrer">` near the selection (same positioning approach as the tooltip), labelled with `t('feature.dictionaryLookup')`; when it returns null it removes the element. Nothing is fetched — following the link is the visitor's own navigation. The feature reads the widget language from the `lang` attribute on the widget's mount point (`doc.querySelector('[data-pulxon-lang]')?.getAttribute('data-pulxon-lang') ?? 'en'`); if that attribute does not exist yet, add it where the mount point is created in `src/ui/mount.tsx` and say so in the report.

- [ ] **Step 4: Register and name it**

Add to `builtinFeatures`, add `'feature.dictionary': 'Dictionary'` / `'Diccionario'` and `'feature.dictionaryLookup': 'Look up this word'` / `'Buscar esta palabra'` to both locales, and an icon: an open book — reuse the `dyslexia` profile's book path, drawn separately so the two can diverge later.

- [ ] **Step 5: Verify and commit**

Run `pnpm --filter @pulxon/widget test`, `lint`, `typecheck`, `build`, `size`.

```bash
git add packages/widget/src
git commit -m "feat(widget): offer a dictionary lookup for the selected word" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Voice navigation, behind consent

**Files:**
- Create: `packages/widget/src/features/voice-navigation.ts`
- Modify: `packages/widget/src/features/index.ts`, `packages/widget/src/ui/icons.tsx`, both locale files
- Test: `packages/widget/src/features/voice-navigation.test.ts`

**Interfaces:**
- Produces: `export const voiceNavigation: FeatureDefinition` with `id: 'voice-navigation'`, `group: 'navigation'`, `levels: 1`, and `isSupported(doc)` returning false where the browser has no speech recognition, so the tile never appears there.
- Produces: `export const VOICE_COMMANDS` — the command table, so the test and the panel copy stay in step.

- [ ] **Step 1: Write the failing test**

Create `packages/widget/src/features/voice-navigation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @pulxon/widget test -- voice-navigation`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

Create `packages/widget/src/features/voice-navigation.ts`:

```ts
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
```

The feature: `isSupported` checks `'SpeechRecognition' in window || 'webkitSpeechRecognition' in window`. `apply` constructs the recognizer, sets `continuous = true`, `interimResults = false`, takes the last result's transcript, runs `matchCommand`, and acts: `scroll-down`/`scroll-up` scroll by 80% of the viewport height, `top`/`bottom` jump, `back` calls `history.back()`, `stop` tears the feature down. `teardown` aborts the recognizer and drops every listener. Wrap `start()` in try/catch: a browser that refuses the microphone throws, and the widget must not break the page over it.

- [ ] **Step 4: Name it, and say what it costs**

Add to `builtinFeatures`, add an icon (a microphone: `<path d="M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3z" />` plus a stand), and add to both locales:
- `'feature.voiceNavigation'`: `'Voice navigation'` / `'Navegación por voz'`
- `'feature.voiceNavigationNote'`: `'Your browser sends what you say to its own speech service. Pulxon never receives it.'` / `'Tu navegador envía lo que dices a su propio servicio de voz. Pulxon nunca lo recibe.'`

The note is rendered by the panel in Task 6; add the key here so both locales stay in step.

- [ ] **Step 5: Verify and commit**

Run `pnpm --filter @pulxon/widget test`, `lint`, `typecheck`, `build`, `size`.

```bash
git add packages/widget/src
git commit -m "feat(widget): add voice navigation where the browser supports it" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The settings block — language, size, position

**Files:**
- Create: `packages/widget/src/ui/PanelSettings.tsx`
- Modify: `packages/widget/src/ui/Panel.tsx`, `packages/widget/src/ui/mount.tsx`, `packages/widget/src/ui/styles.css`, both locale files
- Test: `packages/widget/src/ui/panel-settings.test.tsx`

**Interfaces:**
- Consumes: `Settings.ui` from Task 1.
- Produces: `<PanelSettings t settings store lang onLangChange />` rendering three rows: the language picker, the size toggle and the position picker.

- [ ] **Step 1: Write the failing test**

Create `packages/widget/src/ui/panel-settings.test.tsx` following the setup in `panel.test.tsx` (same `mountUI` harness, same cleanup). Assert, through the rendered panel:

```tsx
it('offers the languages the widget ships', async () => {
  const { host } = setup();
  const select = host.shadowRoot!.querySelector<HTMLSelectElement>('[data-pulxon-lang-picker]')!;
  expect([...select.options].map((option) => option.value)).toEqual(['auto', 'en', 'es']);
});

it('makes the widget larger and remembers it', async () => {
  const { host, store } = setup();
  const large = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-scale="large"]')!;
  await act(async () => large.click());
  expect(store.get().ui.scale).toBe('large');
  expect(large.getAttribute('aria-pressed')).toBe('true');
});

it('moves the launcher and remembers it', async () => {
  const { host, store } = setup();
  const corner = host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pulxon-position="bottom-left"]')!;
  await act(async () => corner.click());
  expect(store.get().ui.position).toBe('bottom-left');
});

it('names every control for a screen reader', () => {
  const { host } = setup();
  for (const selector of ['[data-pulxon-lang-picker]', '[data-pulxon-scale="large"]', '[data-pulxon-position="bottom-left"]']) {
    const element = host.shadowRoot!.querySelector(selector)!;
    const name = element.getAttribute('aria-label') ?? element.getAttribute('aria-labelledby');
    expect(name, selector).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @pulxon/widget test -- panel-settings`
Expected: FAIL — the elements do not exist.

- [ ] **Step 3: Build the block**

`PanelSettings.tsx` renders, in this order, under the panel header:
1. **Language** — a native `<select data-pulxon-lang-picker>` with a visible `<label>`: `auto` (labelled `t('settings.languageAuto')`), then one option per locale the widget ships (`en`, `es`). Changing it writes `settings.lang` through the store; `auto` writes `null`.
2. **Size** — two buttons in a group labelled `t('settings.size')`, `data-pulxon-scale="normal"` and `="large"`, `aria-pressed` on the active one, writing `ui.scale`.
3. **Position** — a 3×3 grid of buttons, one per `Position`, each `data-pulxon-position="<value>"` with an `aria-label` naming the corner (`t('position.bottomRight')` and so on), `aria-pressed` on the current one, writing `ui.position`.

Keys for both locales: `settings.language`, `settings.languageAuto`, `settings.size`, `settings.sizeNormal`, `settings.sizeLarge`, `settings.position`, and `position.topLeft` … `position.bottomRight` (nine).

- [ ] **Step 4: Make the choices take effect**

In `mount.tsx`, the launcher's position and the UI scale currently come from `options`. Read them from the store instead, falling back to `options` when `ui.position` is null:
- position: `settings.ui.position ?? options.position` (and the mobile override keeps working as it does today);
- scale: when `ui.scale === 'large'`, set `--pulxon-scale: 1.25` on the host and multiply the launcher size and panel font-size by it in CSS. Add that variable to `styles.css`; do not hard-code a second set of sizes.

Both must re-render when the store changes — the component already subscribes; if it does not, subscribe the same way `Panel` does and say so in the report.

- [ ] **Step 5: Style it**

In `styles.css`, add `.settings-row` (a white card like a tile, full width, label on the left and control on the right, wrapping under 320px), `.segmented` (the size toggle: two buttons sharing a pill, the active one filled with the accent and `#ffffff` text), and `.corner-grid` (3×3, each cell a 32px square button with a 2px border, the active one filled with the accent). Every interactive element keeps a visible focus ring.

- [ ] **Step 6: Verify and commit**

Run `pnpm --filter @pulxon/widget test`, `lint`, `typecheck`, `build`, `size`, and `e2e`.

```bash
git add packages/widget/src
git commit -m "feat(widget): let the visitor set language, size and position" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The remaining panel chrome

**Files:**
- Modify: `packages/widget/src/ui/Panel.tsx`, `packages/widget/src/config/options.ts`, `packages/widget/contracts/widget-config.v1.json`, `packages/widget/src/config/remote-config.ts`, `packages/widget/src/ui/styles.css`, both locale files, `README.md`
- Test: `packages/widget/src/ui/panel.test.tsx`, `packages/widget/src/config/options.test.ts`

**Interfaces:**
- Consumes: `voiceNavigation`'s `feature.voiceNavigationNote` key (Task 4).
- Produces: `WidgetOptions.statementUrl: string | null`, parsed from `data-statement-url` and from the remote config's `statementUrl`.

- [ ] **Step 1: Write the failing tests**

In `panel.test.tsx`:

```tsx
it('names the active profile above the tiles', async () => {
  const { host, controller } = setup([biggerText], [lowVision]);
  await act(async () => controller.setProfile('low-vision'));
  const row = host.shadowRoot!.querySelector('[data-pulxon-active-profile]');
  expect(row?.textContent).toContain('Low vision');
});

it('says nothing about a profile when none is active', () => {
  const { host } = setup([biggerText], [lowVision]);
  expect(host.shadowRoot!.querySelector('[data-pulxon-active-profile]')).toBeNull();
});

it('explains where voice navigation sends what you say', () => {
  const { host } = setup([voiceNavigation], []);
  const note = host.shadowRoot!.querySelector('[data-pulxon-voice-note]');
  expect(note?.textContent).toContain('speech service');
});

it('links to the accessibility statement when the site gives one', () => {
  const { host } = setup([biggerText], [], { statementUrl: 'https://example.com/accessibility' });
  const link = host.shadowRoot!.querySelector<HTMLAnchorElement>('[data-pulxon-statement]');
  expect(link?.href).toBe('https://example.com/accessibility');
  expect(link?.target).toBe('_blank');
});

it('shows no statement link when the site gives none', () => {
  const { host } = setup([biggerText], []);
  expect(host.shadowRoot!.querySelector('[data-pulxon-statement]')).toBeNull();
});
```

Extend the file's `setup` helper with an optional third argument of partial options, merged over the defaults.

In `options.test.ts`:

```ts
it('accepts an https statement url and rejects anything else', () => {
  expect(resolveOptions(attrs({ 'data-statement-url': 'https://example.com/a11y' })).statementUrl).toBe('https://example.com/a11y');
  expect(resolveOptions(attrs({ 'data-statement-url': 'javascript:alert(1)' })).statementUrl).toBeNull();
  expect(resolveOptions(attrs({ 'data-statement-url': 'not a url' })).statementUrl).toBeNull();
});
```

Match the file's existing helper for building attributes.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter @pulxon/widget test -- panel options`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `options.ts`: add `statementUrl: string | null` to `WidgetOptions` and `null` to `DEFAULT_OPTIONS`; parse `data-statement-url` with the same URL guard the file already uses for other URLs — accept only `http:`/`https:`, otherwise null.
- `contracts/widget-config.v1.json` and `remote-config.ts`: add the same optional `statementUrl` string so a dashboard can set it later. Keep the contract file byte-identical to its copy in the platform repo (`platform/packages/widget-config/contract/widget-config.v1.json`) — if you change one, change both, and say so in the report.
- `Panel.tsx`: render, in this order — the active-profile row (only when `settings.profile` is set, `data-pulxon-active-profile`, naming the profile through `t()`); the voice note (`data-pulxon-voice-note`, only when the voice feature is in the visible list); and in the footer, above the branding, the statement link (`data-pulxon-statement`, `target="_blank"`, `rel="noopener noreferrer"`, text `t('panel.statement')`, with the existing `link.newTab` suffix pattern for screen readers).
- Locales: `panel.statement` (`'Accessibility statement'` / `'Declaración de accesibilidad'`), `panel.activeProfile` (`'{name} profile is on'` / `'Perfil {name} activado'`).
- README: document `data-statement-url` in the attribute table, and add the three new features to the feature list, with one sentence each on what voice navigation and the dictionary do about privacy.

- [ ] **Step 4: Verify and commit**

Run `pnpm --filter @pulxon/widget test`, `lint`, `typecheck`, `build`, `size`, `publint`.

```bash
git add packages/widget README.md
git commit -m "feat(widget): show the active profile, the voice note and the statement link" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Prove it end to end

**Files:**
- Modify: `packages/widget/e2e/features.spec.ts` (the panel's feature coverage) and `packages/widget/e2e/widget.spec.ts`
  (the launcher and embed options); `packages/widget/e2e/fixture.ts` serves the page both use — read all three first
- Modify: `packages/widget/CHANGELOG.md`

- [ ] **Step 1: Add the e2e coverage**

In the widget's e2e suite, add to the existing fixture page and assert:
- turning **Tooltips** on, hovering a link with a `title`, and seeing the tooltip text;
- selecting a word with **Dictionary** on and seeing a lookup link whose `href` is the Wiktionary URL — do not click it, the suite must not leave the fixture;
- switching the language picker to Spanish and seeing the panel heading change;
- pressing the **large** size button and seeing the launcher's rendered width grow;
- pressing a corner in the position grid and seeing the launcher move to that corner;
- with a `data-statement-url` on the embed, seeing the statement link; without it, seeing none.

Voice navigation has no e2e: the suite cannot grant a microphone. Assert instead that the tile is absent in the fixture browser when speech recognition is unavailable, and say in the report that the rest is covered by unit tests.

- [ ] **Step 2: Run the whole suite**

Run, from `widget/`: `pnpm --filter @pulxon/widget e2e`
Expected: every test passes.

- [ ] **Step 3: Write the changelog**

Add a `0.4.0` entry to `packages/widget/CHANGELOG.md` under Added: tooltips, dictionary lookup, voice navigation, the in-panel language, size and position controls, the active-profile row and the statement link. Under Changed: the panel's new layout from the previous branch if it is not already listed. Bump `version` in `packages/widget/package.json` to `0.4.0` and update `VENDORED_WIDGET_VERSION` expectations only in this repo — the platform's copy is updated separately when the build is vendored.

- [ ] **Step 4: Final verification and commit**

Run `pnpm --filter @pulxon/widget test`, `lint`, `typecheck`, `build`, `size`, `publint`, `e2e` — all exit 0. Paste the size.

```bash
git add packages/widget
git commit -m "test(widget): cover the new panel controls end to end" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Not in this plan (recorded)

The reference widget also has a **Screen Reader** tile and **Smart Contrast** next to **Contrast +**. We already ship both capabilities under different names — `read-aloud` reads the page with the browser's speech synthesis, and `contrast` has three levels covering inverted, dark and light. Adding second tiles that do the same thing would be padding, not parity.

## Verification of the whole branch

- `pnpm --filter @pulxon/widget test`, `lint`, `typecheck`, `build`, `size`, `publint`, `e2e` each exit 0.
- The bundle is under 40 kB gzip; report the final number.
- The widget still makes no request of its own: the dictionary only renders a link, and voice navigation only starts after the visitor turns it on.
- Every new control is reachable by keyboard with a visible focus ring and an accessible name, and no state is signalled by color alone.
