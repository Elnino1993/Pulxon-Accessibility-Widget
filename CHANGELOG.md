# Changelog

## 0.7.0

### Changed

- The panel is laid out after Sienna Accessibility Widget. It opens docked to the screen edge on the
  launcher's side, full height and 340px wide, and the title bar still drags it off the edge into a
  floating window (picking a position docks it again). Top to bottom: language and size; profiles;
  content adjustments; visual & navigation aids; color adjustments; additional tools; position and
  reset. Each section is a card with an ⓘ that explains it in place (`aria-expanded`), and the title
  bar has a reset button next to close.
- Profiles are cards with an icon, a one-line description of exactly what they turn on, and a switch
  (`role="switch"`, `aria-checked`).
- Bigger text is a − 100% + stepper (120–180%); its ends use `aria-disabled`, so focus stays put.
- Contrast and saturation modes are one tile each — Monochrome, Low saturation, High saturation, High
  contrast, Light contrast, Dark contrast, Invert colors — still one feature each underneath, so modes
  of the same feature replace each other.
- Tiles sit three to a row; labels follow Sienna's names (Font weight, Letter spacing, Highlight
  titles, Super focus, Stop animations).
- The accessibility statement link moves to a footer under the panel.

### Added

- **53 languages.** English is in the bundle; every other language is `dist/locales/<code>.json`,
  fetched from next to the script the first time it is used, and the panel follows the page's own
  language on its own. Translations reuse Sienna's where the wording matches (MIT, credited) and were
  written for the rest. A translation that loses a `{placeholder}` falls back to English for that one
  string. Arabic, Persian, Hebrew and Urdu lay the panel out right to left. New option
  `localeBaseUrl` for npm users; the plugin zips and the kit ship `locales/`.
- A **Cognitive & learning** profile (more line height, a reading guide, highlighted titles).
- A **High contrast** mode (a stronger contrast filter), contrast's fourth level.

### Not copied

- Sienna's "Blind profile" ("activates the screen reader"): a widget cannot stand in for a screen
  reader, and offering one as if it could is an overclaim. Read aloud stays, named honestly. "Seizure
  safe" stays "Reduce motion and color".

### Notes

- A site with a strict CSP needs `connect-src` to allow the script's own origin for any language but
  English; without it the panel stays in English. Spanish was bundled before and is now fetched too.

## 0.6.3

### Fixed

- Licence notices. The widget is partly based on Sienna Accessibility Widget (MIT, copyright 2025
  Benny Luk) and bundles Preact (MIT, copyright 2015-present Jason Miller); MIT's one condition is that
  those notices travel with every copy, and the built script carried none.
  - Every build (`pulxon.min.js` and the npm `index.js`) now starts with a `/*!` banner naming the
    authors and linking the full notices. It is added with Rolldown's `postBanner`, after
    minification, so it is always the first thing in the file.
  - `THIRD_PARTY_NOTICES.txt` (Sienna, Preact, OpenDyslexic) is copied into `dist/` by the build and
    ships in every WordPress, Joomla and Drupal zip; packaging refuses a build without it.
  - `packages/widget/LICENSE` and the root `LICENSE` read Copyright 2026 Pulxon and Copyright 2025
    Benny Luk. The README has a License / Credits section.
- The widget's behaviour is unchanged.

## 0.6.2

### Changed

- The panel's position setting offers three spots along the bottom edge, Left / Center / Right, as
  one segmented control like the size setting, instead of a 3x3 grid of eight corners. A launcher that
  is let go falls to the bottom anyway, so the top and middle spots only fought it. Screen readers hear
  the full names ("Bottom left"), which contain the words on screen. The embed code's `data-position`
  still accepts every position; the picker shows none pressed when the launcher sits outside the
  bottom row.

## 0.6.1

### Changed

- The launcher can still be lifted anywhere, but when it is let go it falls back to the bottom edge,
  keeping the horizontal spot it was dropped at: an accelerating fall, a small bounce (never more than
  24px) and rest. It lands at once, with no fall, when the visitor's OS asks for reduced motion or
  "Pause animations" is on in the widget.
- "Powered by Pulxon" moved from the panel footer to the top, in the title bar under the title, in the
  bar's own contrast-checked foreground, underlined and padded to a 24px target. Pressing it follows
  the link; it does not start a drag of the panel.

## 0.6.0

### Added

- The launcher can be dragged anywhere on the page, with a mouse or a finger. The spot is kept in the
  visitor's own settings as a fraction of the screen, so it survives a reload, a resized window and a
  rotated phone without ending up off screen. A press that barely moves is still a click.
- The panel can be dragged by its title bar and remembers where it was put. Until the visitor moves
  it, it opens beside the launcher, on the side facing the middle of the screen.
- Picking a corner in the panel's position grid puts a dragged launcher back in that corner. That grid
  is the non-drag way to move the widget (WCAG 2.5.7 Dragging Movements).

### Changed

- The panel is a compact floating window (360px wide, at most 640px tall) instead of a full-height
  side sheet. Only its content scrolls; the title bar with the close button stays in view, and
  `overscroll-behavior: contain` keeps a scroll that reaches the end from moving the page behind.
- Tiles are smaller and sit four to a row at the default size (three at Large, or on a narrow phone).
  The "Off" / "2 of 4" status text is no longer shown on the tile, only read out; the dots already
  show the level on screen.

## 0.5.0

### Changed

- The default launcher position is now `bottom-left` instead of `bottom-right`, in the widget
  itself and in every platform package that ships a default (WordPress, Joomla, Drupal, Tag
  Manager, the snippets). The bottom-right corner is where sites already put chat bubbles, cookie
  banners and back-to-top buttons, and a launcher stacked under one of those is unreachable for
  exactly the visitor who needs it. An embed that sets `data-position`, and a connected site that
  saved a position in the dashboard, both keep what they chose.
- The "Powered by Pulxon" signature in the panel footer is now underlined, bold and padded to a
  24px target, so it reads as the link it always was rather than as coloured text. It still opens
  https://pulxon.com in a new tab and still disappears when branding is turned off.

### Fixed

- Added `.gitattributes` (`* text=auto eol=lf`). On Windows, git rewrote the committed snippets to
  CRLF on checkout while the generator emitted LF, so `integrations`' byte-for-byte tests failed on
  a clean checkout and the zips' contents depended on which machine built them.

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
