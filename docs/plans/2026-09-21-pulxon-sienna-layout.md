# Sienna-style panel, 53 languages — plan (2026-09-21)

The founder asked for the panel to look and behave like the current Sienna Accessibility Widget
(screenshots of accessibility-widget.pages.dev, 2026-09-21), with many languages, and with language
and size at the top. Decisions taken with them:

- **Panel**: docked to the screen edge on the launcher's side, full height, ~340px wide, as in Sienna —
  and still draggable by its title bar (a dragged panel floats where it was put until a spot is picked).
- **Scope**: Sienna's look *and* its missing functions, keeping ours.
- **Languages**: Sienna's 53 locales (MIT, already credited); strings Sienna does not have are
  translated by us. Each language is its own file, loaded only when used.

## What we deliberately do not copy

- **"Blind Profile"** ("activates the screen reader"). A widget cannot stand in for a screen reader, and
  offering it as one is the overclaim this company exists to argue against. Read aloud stays, named
  honestly.
- **"PDF Reader"**: no defined behaviour to copy.
- **"Seizure Safe"** as a name: our profile keeps the honest name "Reduce motion and color" — nothing a
  widget does can guarantee seizure safety.
- Branding stays in the title bar (the founder moved it there on 2026-09-21), not in the footer.

## Layout (top to bottom)

1. Title bar (drag handle): title, "Powered by Pulxon" under it, reset icon, close.
2. Card: language select (`Native (English)` labels + "Match this site") and Size (Normal / Large).
3. Card **Accessibility profiles** ⓘ — 2 columns of profile cards: icon, name, one-line description,
   switch. Adds **Cognitive & learning**.
4. Card **Content adjustments** ⓘ — font size stepper (− 100% +) over Bigger text's levels, then
   3-column tiles: Font weight, Line height, Letter spacing, Dyslexia font, Highlight links, Highlight
   titles, Text align.
5. Card **Visual & navigation aids** ⓘ — Super focus, Read aloud, Reading guide, Reading mask, Big cursor,
   Page structure, Voice navigation (where supported).
6. Card **Color adjustments** ⓘ — Monochrome, Low saturation, High saturation, High contrast (new),
   Light contrast, Dark contrast, Invert colors. One tile per mode; modes of one feature are exclusive.
7. Card **Additional tools** ⓘ — Stop animations, Hide images, Tooltips, Dictionary.
8. Card: Position (Left / Center / Right) and **Reset settings**.
9. Footer: accessibility statement link (when the site gives one).

ⓘ toggles a short explanation under the section title (`aria-expanded`), not a hover tooltip.

## Languages

- `en` stays in the bundle as the fallback; every other language is `locales/<code>.json` next to the
  script, fetched on first use and cached. Missing keys fall back to English.
- Auto: `data-lang`, then `<html lang>`, then `navigator.language`; the visitor's pick wins.
- RTL (`ar`, `fa`, `he`, `ur`): the panel gets `dir="rtl"`.
- The build copies `locales/` into `dist/`; the platform vendor script, the plugin zips and the
  standalone kit ship it. CSP: a site on a strict policy needs `connect-src` for the script's origin.

## Tasks

1. Panel shell: docked + draggable, title bar, sticky footer.
2. Top card: language + size.
3. Section cards with ⓘ.
4. Profile cards with switches; Cognitive & learning profile.
5. Font size stepper; content tiles.
6. Visual & navigation tiles.
7. Color tiles: one per mode; new High contrast level.
8. Additional tools; bottom card with position + reset.
9. i18n runtime: lazy locales, RTL, 53-language list, build/vendor/zip/kit wiring.
10. Translations: 52 locale files.
11. Tests (unit, e2e, axe, size), release 0.7.0, vendor into the platform, kit zip.
