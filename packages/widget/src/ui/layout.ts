import type { MessageKey } from '../i18n';

/**
 * A tile in the panel.
 * - `feature`: the feature's own tile; each press steps to its next level, then off.
 * - `mode`: one level of a feature, as its own tile (Monochrome is saturation's third level). The
 *   modes of one feature are exclusive because they are one feature; pressing the active mode turns
 *   the feature off.
 * - `tool`: opens a view inside the panel instead of changing the page.
 */
export type TileSpec =
  | { kind: 'feature'; id: string }
  | { kind: 'mode'; id: string; feature: string; level: number; labelKey: MessageKey }
  | { kind: 'tool'; id: 'page-structure' };

export interface SectionSpec {
  id: 'content' | 'visual' | 'color' | 'tools';
  titleKey: MessageKey;
  infoKey: MessageKey;
  tiles: readonly TileSpec[];
}

/** Bigger text is the font size stepper at the top of Content adjustments, not a tile. */
export const FONT_SIZE_FEATURE = 'bigger-text';

const feature = (id: string): TileSpec => ({ kind: 'feature', id });
const mode = (id: string, of: string, level: number, labelKey: MessageKey): TileSpec => ({ kind: 'mode', id, feature: of, level, labelKey });

export const SECTIONS: readonly SectionSpec[] = [
  {
    id: 'content',
    titleKey: 'section.content',
    infoKey: 'info.content',
    tiles: [
      feature('bold-text'),
      feature('line-height'),
      feature('text-spacing'),
      feature('dyslexia-font'),
      feature('highlight-links'),
      feature('highlight-headings'),
      feature('text-align'),
    ],
  },
  {
    id: 'visual',
    titleKey: 'section.visual',
    infoKey: 'info.visual',
    tiles: [
      feature('focus-highlight'),
      feature('read-aloud'),
      feature('reading-guide'),
      feature('reading-mask'),
      feature('big-cursor'),
      { kind: 'tool', id: 'page-structure' },
      feature('voice-navigation'),
    ],
  },
  {
    id: 'color',
    titleKey: 'section.color',
    infoKey: 'info.color',
    // Levels as in features/color-features.ts: saturation low/high/grayscale, contrast
    // invert/dark/light/high.
    tiles: [
      mode('monochrome', 'saturation', 3, 'mode.monochrome'),
      mode('low-saturation', 'saturation', 1, 'mode.lowSaturation'),
      mode('high-saturation', 'saturation', 2, 'mode.highSaturation'),
      mode('high-contrast', 'contrast', 4, 'mode.highContrast'),
      mode('light-contrast', 'contrast', 3, 'mode.lightContrast'),
      mode('dark-contrast', 'contrast', 2, 'mode.darkContrast'),
      mode('invert', 'contrast', 1, 'mode.invert'),
    ],
  },
  {
    id: 'tools',
    titleKey: 'section.tools',
    infoKey: 'info.tools',
    tiles: [feature('pause-animations'), feature('hide-images'), feature('tooltips'), feature('dictionary')],
  },
];

/** Every feature the layout places somewhere, as a tile, a mode or the stepper. */
export function placedFeatures(): Set<string> {
  const placed = new Set<string>([FONT_SIZE_FEATURE]);
  for (const section of SECTIONS) {
    for (const tile of section.tiles) {
      if (tile.kind === 'feature') placed.add(tile.id);
      if (tile.kind === 'mode') placed.add(tile.feature);
    }
  }
  return placed;
}

/** Every mode tile's id, for the icon set. */
export const MODE_TILE_IDS: readonly string[] = SECTIONS.flatMap((section) => section.tiles.filter((tile) => tile.kind === 'mode').map((tile) => tile.id));
