# Changelog

All notable changes to `@pulxon/widget` are documented in this file.

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

## 0.3.0 and earlier

Not tracked in this file.
