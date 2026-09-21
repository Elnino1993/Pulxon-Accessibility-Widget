import { cssFeature, pick, scoped } from './shared';

/** Shared by contrast and saturation so both filters combine; each sheet sets only its own variable. */
export const FILTER_RULE =
  'html{filter:var(--pulxon-f-contrast,contrast(1)) var(--pulxon-f-saturation,saturate(1))!important}';

const ALL = ['body', 'body *'] as const;
const INVERT_BACK = ['img', 'video', 'canvas', 'iframe', 'svg image', 'object', 'embed'] as const;
const MEDIA = ['img', 'picture', 'video', 'canvas', 'iframe', 'svg', 'object', 'embed'] as const;

// Appended, never reordered: a visitor's stored level is an index into this list.
export const CONTRAST_MODES = ['invert', 'dark', 'light', 'high'] as const;

/** High contrast: a stronger contrast filter over the whole page. */
const HIGH_CONTRAST = 'contrast(1.3)';
export const SATURATION_FILTERS = ['saturate(0.5)', 'saturate(2)', 'grayscale(1)'] as const;

const UNDO_INVERT = 'invert(1) hue-rotate(180deg)';

/**
 * Inverts the page and re-inverts media and the widget's own overlays. `--pulxon-f-undo` inherits into the
 * widget's shadow tree, where the launcher and panel use it to keep their real colors.
 */
function invertCss(): string {
  return (
    `html{--pulxon-f-contrast:${UNDO_INVERT};--pulxon-f-undo:${UNDO_INVERT}}${FILTER_RULE}` +
    `${scoped(INVERT_BACK)}{filter:${UNDO_INVERT}!important}` +
    `.pulxon-reading-mask,.pulxon-reading-guide{filter:${UNDO_INVERT}!important}`
  );
}

function paletteCss(background: string, text: string, link: string): string {
  return (
    `${scoped(['html', ...ALL])}{background-color:${background}!important;color:${text}!important;border-color:${text}!important}` +
    `${scoped(['a', 'a *'])}{color:${link}!important}` +
    `${scoped(MEDIA)}{background-color:transparent!important}`
  );
}

export const contrast = cssFeature({
  id: 'contrast',
  group: 'color',
  labelKey: 'feature.contrast',
  levels: CONTRAST_MODES.length,
  levelLabelKeys: ['level.invert', 'level.dark', 'level.light', 'level.high'],
  css: (level) => {
    const mode = pick(CONTRAST_MODES, level);
    if (mode === 'invert') return invertCss();
    // No undo for the widget, unlike invert: the panel is already black, white and one accent, and
    // a contrast boost leaves those as they are.
    if (mode === 'high') return `html{--pulxon-f-contrast:${HIGH_CONTRAST}}${FILTER_RULE}`;
    if (mode === 'dark') return paletteCss('#000000', '#ffffff', '#ffeb3b');
    return paletteCss('#ffffff', '#000000', '#0000ee');
  },
});

export const saturation = cssFeature({
  id: 'saturation',
  group: 'color',
  labelKey: 'feature.saturation',
  levels: SATURATION_FILTERS.length,
  levelLabelKeys: ['level.low', 'level.high', 'level.grayscale'],
  css: (level) => `html{--pulxon-f-saturation:${pick(SATURATION_FILTERS, level)}}${FILTER_RULE}`,
});

export const hideImages = cssFeature({
  id: 'hide-images',
  group: 'distraction',
  labelKey: 'feature.hideImages',
  levels: 1,
  css: () =>
    `${scoped(['img', 'picture', 'video', 'canvas', 'svg[role="img"]'])}{visibility:hidden!important}` +
    `${scoped(ALL)}{background-image:none!important}`,
});
