# Pulxon Widget

Open-source, lightweight accessibility preferences widget for websites.
Visitors can adjust how a page looks and behaves for them. Settings stay in the
visitor's browser (`localStorage`); the widget collects no personal data and
makes no third-party requests.

> A widget is not a substitute for accessible code. Use it together with
> automated scanning and manual accessibility testing.

Status: early development (v0.x). License: MIT.

## Quick start

Pin an exact version and add Subresource Integrity:

```html
<script src="https://cdn.jsdelivr.net/npm/@pulxon/widget@0.2.0/dist/pulxon.min.js"
        integrity="sha384-REPLACE_WITH_HASH" crossorigin="anonymous"
        data-position="bottom-right" data-color="#1f4bff" defer></script>
```

Generate the hash for the exact file you ship:

```bash
curl -sL https://cdn.jsdelivr.net/npm/@pulxon/widget@0.2.0/dist/pulxon.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

The dyslexia-friendly font is loaded from the `fonts/` folder next to the
script (`dist/fonts/`). When you self-host the script, publish that folder too.

## Features

| Group | Feature id | Levels |
|---|---|---|
| Text | `bigger-text` | 4 |
| Text | `text-spacing` | 3 |
| Text | `line-height` | 3 |
| Text | `text-align` | 4 (left, right, center, justify) |
| Text | `dyslexia-font` | 1 |
| Text | `bold-text` | 1 |
| Color | `contrast` | 3 (inverted, dark, light) |
| Color | `saturation` | 3 (low, high, grayscale) |
| Navigation | `highlight-links` | 1 |
| Navigation | `highlight-headings` | 1 |
| Navigation | `focus-highlight` | 1 |
| Reading | `read-aloud` | 3 (normal, fast, slow) — only where the Web Speech API exists |
| Reading | `reading-mask` | 1 |
| Reading | `reading-guide` | 1 |
| Reading | `big-cursor` | 1 |
| Distractions | `pause-animations` | 1 |
| Distractions | `hide-images` | 1 |

The panel also has a **Page structure** tool that lists headings, landmarks
and links and moves focus to the one you choose.

Profiles: `low-vision`, `dyslexia`, `adhd`, `seizure-safe`, `keyboard`.

## Data attributes

| Attribute | Values | Default |
|---|---|---|
| `data-position` | `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right` | `bottom-right` |
| `data-offset` | `x,y` in px | `20,20` |
| `data-color` | hex color | `#1f4bff` |
| `data-size` | `small`, `medium`, `large` | `medium` |
| `data-lang` | `en`, `es` | auto |
| `data-hide-on-mobile` | `true` / `false` | `false` |
| `data-trigger` | CSS selector of your own button | — |
| `data-nonce` | CSP nonce for the `<style>` fallback | — |
| `data-z-index` | integer | `2147483000` |

Keyboard: `Alt+A` opens or closes the menu. Add `data-pulxon-ignore` to any
element to exclude it from page adjustments.

To hide the widget with CSS (for example on specific pages), target its root
element — this is the supported way:

```css
#pulxon-root { display: none; }
```

The widget is also hidden automatically when the page is printed.

## JavaScript API

```js
document.addEventListener('pulxon:ready', (event) => {
  const pulxon = event.detail; // same as window.Pulxon
  pulxon.enable('bigger-text', 2);
  pulxon.setProfile('dyslexia');
  pulxon.on('change', (settings) => console.log(settings.features));
});
```

`version`, `open()`, `close()`, `toggle()`, `reset()`, `enable(id, level?)`,
`disable(id)`, `toggleFeature(id)`, `setProfile(id | null)`, `getSettings()`,
`on('change' | 'open' | 'close', listener)`, `destroy()`.
DOM events: `pulxon:ready`, `pulxon:change`.

## npm

```bash
npm install @pulxon/widget preact
```

```js
import { createWidget } from '@pulxon/widget';

const pulxon = createWidget({
  options: { position: 'bottom-left', fontBaseUrl: '/assets/pulxon-fonts/' },
});
```

Copy `node_modules/@pulxon/widget/dist/fonts/` to the URL you pass as
`fontBaseUrl`. Without it, the dyslexia-friendly option uses locally installed
fonts only.

## Content Security Policy

Styles are applied with constructable stylesheets, so `style-src 'unsafe-inline'`
is not required in modern browsers. In browsers without constructable
stylesheets, pass `data-nonce` and allow that nonce in `style-src`.
The big cursor uses `data:` SVG images; if your `img-src` blocks `data:`, the
normal cursor is shown instead.

## Development

```bash
pnpm install
cd packages/widget
pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm size && pnpm publint && pnpm e2e
```

See `THIRD_PARTY_NOTICES.md` for third-party licenses.
