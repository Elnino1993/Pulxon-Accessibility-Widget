# Pulxon Widget

Open-source, lightweight accessibility preferences widget for websites.
Visitors can adjust how a page looks and behaves for them (for example,
highlighting links or pausing animations). Settings stay in the visitor's
browser (`localStorage`); the widget collects no personal data and makes no
third-party requests.

> A widget is not a substitute for accessible code. Use it together with
> automated scanning and manual accessibility testing.

Status: early development (v0.x). License: MIT.

## Quick start

```html
<script src="https://cdn.jsdelivr.net/npm/@pulxon/widget@0/dist/pulxon.min.js"
        data-position="bottom-right" data-color="#1f4bff" defer></script>
```

### Data attributes

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
  pulxon.enable('highlight-links');
  pulxon.on('change', (settings) => console.log(settings.features));
});
```

`version`, `open()`, `close()`, `toggle()`, `reset()`, `enable(id, level?)`,
`disable(id)`, `toggleFeature(id)`, `setProfile(id | null)`, `getSettings()`,
`on('change' | 'open' | 'close', listener)`, `destroy()`.
DOM events: `pulxon:ready`, `pulxon:change`.

## npm

```js
import { createWidget } from '@pulxon/widget';
const pulxon = createWidget({ options: { position: 'bottom-left' } });
```

## Content Security Policy

Styles are applied with constructable stylesheets, so `style-src 'unsafe-inline'`
is not required in modern browsers.

## Development

```bash
pnpm install
cd packages/widget
pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm size && pnpm e2e
```

See `THIRD_PARTY_NOTICES.md` for third-party licenses.
