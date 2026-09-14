import { NOT_IGNORED, cssFeature } from './shared';

export const DYSLEXIA_FONT_FAMILY = 'Pulxon OpenDyslexic';

export const DYSLEXIA_FONT_FILES = [
  { weight: 400, file: 'opendyslexic-latin-400-normal.woff2' },
  { weight: 700, file: 'opendyslexic-latin-700-normal.woff2' },
] as const;

const ICON_EXCLUSIONS =
  ':not(i):not(.fa):not([class*="fa-"]):not([class*="icon"]):not(.material-icons)' +
  ':not(.material-symbols-outlined):not(.material-symbols-rounded):not(.material-symbols-sharp)';

export function fontFaceCss(base: string | null | undefined, doc: Document): string {
  if (!base) return '';
  try {
    // URL serialization percent-encodes quotes and braces, so the result is safe inside url("…").
    const root = new URL(base.endsWith('/') ? base : `${base}/`, doc.baseURI);
    return DYSLEXIA_FONT_FILES.map(
      ({ weight, file }) =>
        `@font-face{font-family:"${DYSLEXIA_FONT_FAMILY}";src:url("${new URL(file, root).href}") format("woff2");` +
        `font-weight:${weight};font-style:normal;font-display:swap}`,
    ).join('');
  } catch {
    return '';
  }
}

export const dyslexiaFont = cssFeature({
  id: 'dyslexia-font',
  group: 'text',
  labelKey: 'feature.dyslexiaFont',
  levels: 1,
  css: (_level, { doc, fontBaseUrl }) =>
    `${fontFaceCss(fontBaseUrl, doc)}body${NOT_IGNORED},body *${NOT_IGNORED}${ICON_EXCLUSIONS}` +
    `{font-family:"${DYSLEXIA_FONT_FAMILY}","OpenDyslexic","Comic Sans MS",sans-serif!important}`,
});
