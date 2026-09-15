# Changelog

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
