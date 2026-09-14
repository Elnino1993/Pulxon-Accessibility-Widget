# Changelog

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
- Profiles: low vision, dyslexia, ADHD friendly, seizure safe, keyboard navigation.
- TypeScript declarations; Preact is now a peer-style runtime dependency of the ESM build.

### Changed
- Feature conflicts are symmetric; stored settings are normalized on load.
- Settings written by a newer widget version are never overwritten.

## 0.1.0

- Accessible panel, public API, highlight links and pause animations.
