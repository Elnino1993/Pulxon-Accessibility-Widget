/**
 * The one definition of the Pulxon embed markup. Every installable package
 * and every copy-paste snippet renders its `<script>` tag through this
 * function, so no package hand-types the attribute names or the escaping.
 *
 * Attribute names and boolean semantics mirror `packages/widget/src/config/options.ts`
 * (`parseDataAttributes`) exactly: `data-hide-on-mobile` is read as the string
 * `"true"`, and `data-branding` is read as anything other than the string
 * `"false"` — so a `false` default for `branding` is the *absence* of the
 * attribute, not an explicit `"true"`.
 */
export interface SnippetOptions {
  src: string;
  siteKey?: string | null;
  position?: string | null;
  mobilePosition?: string | null;
  color?: string | null;
  size?: string | null;
  icon?: string | null;
  lang?: string | null;
  statementUrl?: string | null;
  hideOnMobile?: boolean;
  branding?: boolean;
}

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char);
}

/**
 * Ordered so the generated markup — and any diff of a generated file — is
 * stable regardless of the order keys were supplied in `SnippetOptions`.
 */
const ATTRIBUTE_ORDER: Array<{ key: keyof SnippetOptions; attr: string }> = [
  { key: 'siteKey', attr: 'data-site-key' },
  { key: 'position', attr: 'data-position' },
  { key: 'mobilePosition', attr: 'data-mobile-position' },
  { key: 'color', attr: 'data-color' },
  { key: 'size', attr: 'data-size' },
  { key: 'icon', attr: 'data-icon' },
  { key: 'lang', attr: 'data-lang' },
  { key: 'statementUrl', attr: 'data-statement-url' },
];

export function buildScriptTag(options: SnippetOptions): string {
  const parts = [`<script src="${escapeAttribute(options.src)}"`];

  for (const { key, attr } of ATTRIBUTE_ORDER) {
    const value = options[key];
    if (value === null || value === undefined || value === '') continue;
    parts.push(`${attr}="${escapeAttribute(String(value))}"`);
  }

  // The widget reads `data-hide-on-mobile` as the literal string "true" and
  // defaults to false, so only an explicit `true` needs the attribute.
  if (options.hideOnMobile === true) {
    parts.push('data-hide-on-mobile="true"');
  }

  // The widget reads `data-branding` as "anything but the string 'false'"
  // and defaults to true, so only an explicit `false` needs the attribute.
  if (options.branding === false) {
    parts.push('data-branding="false"');
  }

  parts.push('defer');

  return `${parts.join(' ')}></script>`;
}
