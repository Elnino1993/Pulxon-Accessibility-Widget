# Changelog

## 0.4.0

### Added

- Tooltips: hovering or focusing an element with an accessible name (`title`, `aria-label`, or an
  image's `alt`) shows it in a small on-screen tooltip.
- Dictionary: selecting a single word on the page offers a lookup link to that language's
  Wiktionary entry. The widget never fetches it itself — the link only opens when the visitor
  follows it, in a new tab.
- Voice navigation: once the visitor turns it on, spoken commands (scroll up/down, go to
  top/bottom, go back) control the page. The panel states plainly that the browser sends the
  audio to its own speech service; the widget never sees or stores it. Only offered when the
  browser exposes `SpeechRecognition`.
- An in-panel language picker so a visitor can switch the panel's language independently of the
  page's own language, with "Match this site" to fall back to the embed's default.
- An in-panel size control (Normal / Large) that scales the launcher and panel together.
- An in-panel position grid so a visitor can move the launcher to any corner, overriding both the
  embed's default position and its mobile-position override.
- An active-profile row that names the currently applied profile when one is on.
- An accessibility statement link in the panel footer when the site owner configures
  `data-statement-url`.

### Changed

- Rebuilt the panel layout around a three-column tile grid with an accent header, a round close
  button, and a full-width reset pill. The pressed state is now a tinted card with an accent
  border and a check badge — a shape, not just a color, so it isn't lost to color-blind or
  high-contrast visitors.

## 0.3.0

### Added
- Connected mode: with `data-site-key`, the widget loads its settings from the Pulxon dashboard
  (`GET {data-api}/v1/sites/{siteKey}/config`, default API `https://api.pulxon.com`). The request sends no cookies,
  gives up after 3 seconds and falls back to local options. Explicit data attributes override dashboard settings.
- `data-icon` (`person`, `eye`, `contrast`), `data-mobile-position`, `data-disabled-features` (comma-separated
  feature ids) and `data-branding="false"`.
- Profiles that reference a disabled feature are hidden from the panel entirely, rather than trimmed down to
  their remaining features.

### Changed
- Offsets must be integers from 0 to 200 and `data-lang` must look like a language tag; invalid values are ignored.
  This stricter validation applies to options passed to `createWidget` as well, not only to data attributes.
- `WidgetOptions` has five new required fields: `mobilePosition`, `icon`, `disabledFeatures`, `branding` and
  `apiBase`. Code that builds a full `WidgetOptions` object must add them or spread `DEFAULT_OPTIONS`.

## 0.2.0

### Added
- Text: bigger text (4 levels), text spacing (3 levels, WCAG 1.4.12 at level 1), line height (1.5 / 1.75 / 2),
  text alignment, self-hosted dyslexia-friendly font (OpenDyslexic), bold text.
- Color: contrast (inverted, dark, light) and saturation (low, high, grayscale) that combine.
- Navigation: highlight headings and a stronger keyboard focus ring.
- Reading: read aloud through the browser's Web Speech API (normal, fast, slow), reading mask, reading guide,
  big cursor.
- Distractions: hide images.
- Page structure tool listing headings, landmarks and links.
- Profiles: low vision, dyslexia, ADHD friendly, reduce motion and color, keyboard navigation.
- TypeScript declarations; the ESM build imports `preact` (listed in dependencies) instead of bundling it.

### Changed
- Feature conflicts are symmetric; stored settings are normalized on load.
- Settings written by a newer widget version are never overwritten.

## 0.1.0

- Accessible panel, public API, highlight links and pause animations.
