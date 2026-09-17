# Pulxon Widget

Open-source, lightweight accessibility preferences widget for websites.
Visitors can adjust how a page looks and behaves for them. Settings stay in
the visitor's browser (`localStorage`). Without `data-site-key`, the widget
makes no requests other than loading its own files (the script and,
optionally, its font) — except that voice navigation and read aloud, once the
visitor turns them on, use the browser's own speech services (see below). In
connected mode (`data-site-key` set) it makes one request per page view to
the Pulxon API to fetch your dashboard settings; that request carries the
site key in the URL, no cookies and not the page URL — though, as with any
request, the browser sends the visitor's IP address and the page's origin.

> A widget is not a substitute for accessible code. Use it together with
> automated scanning and manual accessibility testing.

Status: early development (v0.x). License: MIT.

## Quick start

Pin an exact version and add Subresource Integrity:

```html
<script src="https://cdn.jsdelivr.net/npm/@pulxon/widget@0.3.0/dist/pulxon.min.js"
        integrity="sha384-REPLACE_WITH_HASH" crossorigin="anonymous"
        data-position="bottom-left" data-color="#1f4bff" defer></script>
```

Generate the hash for the exact file you ship:

```bash
curl -sL https://cdn.jsdelivr.net/npm/@pulxon/widget@0.3.0/dist/pulxon.min.js | openssl dgst -sha384 -binary | openssl base64 -A
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
| Navigation | `tooltips` | 1 |
| Navigation | `highlight-headings` | 1 |
| Navigation | `focus-highlight` | 1 |
| Navigation | `voice-navigation` | 1 — only where the browser's speech recognition API exists |
| Reading | `read-aloud` | 3 (normal, fast, slow) — only where the Web Speech API exists |
| Reading | `reading-mask` | 1 |
| Reading | `reading-guide` | 1 |
| Reading | `dictionary` | 1 |
| Reading | `big-cursor` | 1 |
| Distractions | `pause-animations` | 1 |
| Distractions | `hide-images` | 1 |

Read aloud uses the voices of the visitor's browser or operating system and
prefers an on-device voice for the page language when one is available. Some
voices are provided by online services of the browser vendor.

Voice navigation starts only after the visitor turns it on; the panel always
shows, next to the tile, that the browser sends what they say to its own
speech recognition service — Pulxon never receives the audio or the
transcript. The dictionary never fetches anything itself: it renders a link
to Wiktionary, a third-party site, that the visitor chooses to open.

The panel also has a **Page structure** tool that lists headings, landmarks
and links and moves focus to the one you choose.

Profiles: `low-vision`, `dyslexia`, `adhd`, `seizure-safe` (reduce motion and
color), `keyboard`.

## Data attributes

| Attribute | Values | Default |
|---|---|---|
| `data-position` | `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right` | `bottom-left` |
| `data-offset` | `x,y` in px | `20,20` |
| `data-color` | hex color | `#1f4bff` |
| `data-size` | `small`, `medium`, `large` | `medium` |
| `data-lang` | `en`, `es` | auto |
| `data-hide-on-mobile` | `true` / `false` | `false` |
| `data-trigger` | CSS selector of your own button | — |
| `data-nonce` | CSP nonce for the `<style>` fallback | — |
| `data-z-index` | integer | `2147483000` |
| `data-site-key` | your Pulxon site key (`pk_live_...`) | — |
| `data-api` | base URL of the Pulxon API (connected mode) | `https://api.pulxon.com` |
| `data-icon` | `person`, `eye`, `contrast` | `person` |
| `data-mobile-position` | same values as `data-position` | same as `data-position` |
| `data-disabled-features` | comma-separated feature ids to remove from the panel | — |
| `data-branding` | `false` hides the "Powered by Pulxon" link; ignored when `data-site-key` is present | `true` |
| `data-statement-url` | absolute `http:`/`https:` URL of your site's own accessibility statement | — |

`data-mobile-position` is only a default for visitors who haven't chosen anything: the panel lets a
visitor move the widget to any corner themselves, and once they have, their choice follows them at
every screen size — including narrow ones — instead of being reset back to `data-mobile-position`.

Keyboard: `Alt+A` opens or closes the menu. Add `data-pulxon-ignore` to any
element to exclude it from page adjustments.

To hide the widget with CSS (for example on specific pages), target its root
element — this is the supported way:

```css
#pulxon-root { display: none; }
```

The widget is also hidden automatically when the page is printed.

## Connected mode

Add `data-site-key` to load your settings from the Pulxon dashboard instead of
hard-coding them as data attributes. Paste the embed code from your Pulxon
dashboard; it has this shape:

```html
<script src="https://…/pulxon.min.js" data-site-key="pk_live_xxxxxxxx" defer></script>
```

On boot, the widget sends `GET {data-api}/v1/sites/{siteKey}/config` (default
API `https://api.pulxon.com`) to fetch the settings saved in your dashboard —
position, color, size, icon, language, disabled features and more. The
request carries no cookies and no personal data, just the site key in the
path. If the API does not answer within 3 seconds, or answers with an error
or a config it cannot understand, the widget falls back to its local options
(defaults plus any data attributes) so the page is never blocked. Any data
attribute you set explicitly always overrides the matching dashboard setting,
except `data-branding`: with a valid `data-site-key`, the dashboard always
decides branding, so `data-branding` is ignored.

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

Connected mode is automatic only for the script-tag embed above. From npm,
fetch the dashboard config yourself and pass the result in as options:

```js
import { createWidget, fetchRemoteConfig } from '@pulxon/widget';

const remote = (await fetchRemoteConfig({ siteKey: 'pk_live_xxxxxxxx', apiBase: 'https://api.pulxon.com' })) ?? {};
const pulxon = createWidget({ options: { ...remote, position: 'bottom-left' } });
```

## Content Security Policy

Styles are applied with constructable stylesheets, so `style-src 'unsafe-inline'`
is not required in modern browsers. In browsers without constructable
stylesheets, pass `data-nonce` and allow that nonce in `style-src`.
The big cursor uses `data:` SVG images; if your `img-src` blocks `data:`, the
normal cursor is shown instead.
The dyslexia-friendly font is fetched from the script's origin (or from
`fontBaseUrl`), so `font-src` must allow that origin (for example
`https://cdn.jsdelivr.net`). Subresource Integrity covers
only the script, not the font files.
Connected mode (`data-site-key`) fetches settings over `fetch()`, so its
`connect-src` must allow the API origin, for example
`connect-src https://api.pulxon.com`.

## Development

```bash
pnpm install
cd packages/widget
pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm size && pnpm publint && pnpm e2e
```

See `THIRD_PARTY_NOTICES.md` for third-party licenses.
