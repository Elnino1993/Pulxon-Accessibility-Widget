import type { JSX } from 'preact';

/**
 * One icon per tile, drawn inline so the widget still makes no requests of its own. Every icon is
 * decorative: the tile's visible label is the accessible name, so the SVG is hidden from assistive
 * technology rather than duplicating it.
 *
 * All of them share one grid — a 24×24 box, 2px strokes, round caps and joins, no fills — so the
 * set reads as one family, and `currentColor` keeps them legible on both the resting tile and the
 * accent-colored pressed state.
 */
const PATHS: Record<string, JSX.Element> = {
  // Text
  'bigger-text': (
    <>
      <path d="M3 17 7 7l4 10" />
      <path d="M4.4 14h5.2" />
      <path d="M13 19 18 5l5 14" />
      <path d="M14.8 15h6.4" />
    </>
  ),
  'bold-text': (
    <>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
      <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </>
  ),
  'line-height': (
    <>
      <path d="M4 4v16" />
      <path d="m1.5 6.5 2.5-3 2.5 3" />
      <path d="m1.5 17.5 2.5 3 2.5-3" />
      <path d="M10 7h11" />
      <path d="M10 12h11" />
      <path d="M10 17h11" />
    </>
  ),
  'text-spacing': (
    <>
      <path d="M4 5v14" />
      <path d="M20 5v14" />
      <path d="M8 9h8" />
      <path d="M8 15h8" />
    </>
  ),
  'text-align': (
    <>
      <path d="M4 6h16" />
      <path d="M4 11h10" />
      <path d="M4 16h16" />
      <path d="M4 21h10" />
    </>
  ),
  'dyslexia-font': (
    <>
      <path d="M4 16 9 6l5 10" />
      <path d="M5.6 13h6.8" />
      <path d="M17 6v10" />
      <path d="M20 9a3 3 0 1 0 0 6" />
      <path d="M3 20c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    </>
  ),

  // Color
  contrast: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  saturation: (
    <>
      <path d="M12 3.5c3.5 4 6 6.8 6 9.8a6 6 0 0 1-12 0c0-3 2.5-5.8 6-9.8z" />
      <path d="M12 19.3a6 6 0 0 0 6-6" />
    </>
  ),
  'hide-images': (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="m5 17 5-5 3 3 2-2 4 4" />
      <path d="M3 3 21 21" />
    </>
  ),

  // Navigation
  'highlight-links': (
    <>
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </>
  ),
  'highlight-headings': (
    <>
      <path d="M5 5v10" />
      <path d="M13 5v10" />
      <path d="M5 10h8" />
      <path d="M4 20h16" />
    </>
  ),
  'focus-highlight': (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3" />
      <path d="M16 4h3a1 1 0 0 1 1 1v3" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
      <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  tooltips: (
    <>
      <path d="M4 5h16v11H9l-4 4z" />
    </>
  ),
  'big-cursor': (
    <>
      <path d="M6 3.5 18.5 12l-5.4 1.1 2.6 5.8-2.6 1.2-2.7-5.9-4.4 3z" />
    </>
  ),
  'voice-navigation': (
    <>
      <path d="M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3z" />
      <path d="M7 11a5 5 0 0 0 10 0" />
      <path d="M12 16v4" />
      <path d="M9 20h6" />
    </>
  ),

  // Reading
  'reading-mask': (
    <>
      <path d="M3 5h18v14H3z" />
      <path d="M3 10h18v4H3z" fill="currentColor" stroke="none" opacity="0.35" />
      <path d="M3 10h18" />
      <path d="M3 14h18" />
    </>
  ),
  'reading-guide': (
    <>
      <path d="M3 12h18" />
      <path d="m7 8-4 4 4 4" />
      <path d="m17 8 4 4-4 4" />
    </>
  ),
  'read-aloud': (
    <>
      <path d="M4 9.5h3l4.5-4v13L7 14.5H4z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18.3 6.4a8 8 0 0 1 0 11.2" />
    </>
  ),
  dictionary: (
    <>
      <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v13c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-13c-4.5 0-6.5.5-8 2z" />
      <path d="M12 6.5v13" />
    </>
  ),

  // Distractions
  'pause-animations': (
    <>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </>
  ),

  // Tools and profiles
  'page-structure': (
    <>
      <path d="M5 5h14" />
      <path d="M8 10h11" />
      <path d="M8 15h11" />
      <path d="M8 20h11" />
      <path d="M5 5v15" />
    </>
  ),
  'low-vision': (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  dyslexia: (
    <>
      <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v13c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-13c-4.5 0-6.5.5-8 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  adhd: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  'seizure-safe': (
    <>
      <path d="m13 3-7 9h5l-2 9 7-9h-5z" />
      <path d="M3 3 21 21" />
    </>
  ),
  keyboard: (
    <>
      <path d="M3 6h18v12H3z" />
      <path d="M7 10h.01" />
      <path d="M11 10h.01" />
      <path d="M15 10h.01" />
      <path d="M8 14h8" />
    </>
  ),
};

/** Every tile id this set covers. A tile without an icon simply renders none. */
export const ICON_IDS: readonly string[] = Object.keys(PATHS);

export function hasIcon(id: string): boolean {
  return id in PATHS;
}

export function TileIcon({ id }: { id: string }): JSX.Element | null {
  const paths = PATHS[id];
  if (!paths) return null;
  return (
    <svg
      class="tile__icon"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
}
