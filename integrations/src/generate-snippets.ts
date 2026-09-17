/**
 * The one place that decides what goes in every copy-paste snippet under
 * `integrations/snippets/`. Every snippet's `<script>` tag is rendered
 * through `buildScriptTag` (from `./snippet`), never typed by hand into the
 * platform file directly, so the attribute names and escaping in a snippet
 * can never drift from what the widget itself reads
 * (`packages/widget/src/config/options.ts`, `parseDataAttributes`).
 *
 * `integrations/src/snippets.test.ts` imports the same `SNIPPET_PLATFORMS`
 * and `renderSnippet` this module exports and asserts every file on disk
 * under `integrations/snippets/` still matches what they produce — so a
 * hand-edit that drifts from `buildScriptTag` fails the test, not just a
 * silent inconsistency.
 */
import { buildScriptTag } from './snippet';

/**
 * These platforms have no installable-package format (no plugin store, no
 * theme file a build step can zip) — a site owner pastes HTML/Liquid
 * directly into a field the platform gives them. `@pulxon/widget` has never
 * been published to npm, so a jsDelivr (or unpkg) URL 404s; there is no
 * Pulxon-run CDN either. Like the WordPress/Joomla/Drupal packages, these
 * snippets self-host instead: the owner uploads the widget's built files
 * (from the widget zip) to a `/pulxon/` folder at their own site's root —
 * see `integrations/snippets/README.md` — and this path resolves against
 * that folder, on the owner's own domain.
 */
export const WIDGET_SRC = '/pulxon/pulxon.min.js';

export interface SnippetPlatform {
  /** Matches the dashboard's own platform id and the file's basename (without extension). */
  id: string;
  /** File name under `integrations/snippets/`. */
  file: string;
  /** Name shown to a site owner. */
  displayName: string;
  /** Where in the platform's own UI or theme files the snippet goes. */
  installLocation: string;
  /** Opening delimiter for a comment in this file's language. */
  commentOpen: string;
  /** Closing delimiter for a comment in this file's language (empty for a line comment). */
  commentClose: string;
}

export const SNIPPET_PLATFORMS: SnippetPlatform[] = [
  {
    id: 'shopify',
    file: 'shopify.liquid',
    displayName: 'Shopify',
    installLocation: 'Online Store → Themes → Edit code → layout/theme.liquid, right before </body>',
    commentOpen: '{% comment %}',
    commentClose: '{% endcomment %}',
  },
  {
    id: 'squarespace',
    file: 'squarespace.html',
    displayName: 'Squarespace',
    installLocation: 'Settings → Advanced → Code Injection → Footer, which Squarespace renders right before </body> on every page',
    commentOpen: '<!--',
    commentClose: '-->',
  },
  {
    id: 'wix',
    file: 'wix.html',
    displayName: 'Wix',
    installLocation: 'Settings → Custom Code → Add Custom Code, placed at Body - end (right before </body>), applied to All Pages',
    commentOpen: '<!--',
    commentClose: '-->',
  },
  {
    id: 'webflow',
    file: 'webflow.html',
    displayName: 'Webflow',
    installLocation: 'Project Settings → Custom Code → Footer Code, which Webflow renders right before </body> site-wide',
    commentOpen: '<!--',
    commentClose: '-->',
  },
  {
    id: 'tilda',
    file: 'tilda.html',
    displayName: 'Tilda',
    installLocation: 'Site Settings → More → Additional code → "Paste code before </body>"',
    commentOpen: '<!--',
    commentClose: '-->',
  },
  {
    id: 'bitrix',
    file: 'bitrix.php',
    displayName: 'Bitrix (1C-Bitrix)',
    installLocation: 'local/templates/<your template>/footer.php, right before </body> (or Marketing → HTML code insertion, if your edition has it)',
    commentOpen: '<!--',
    commentClose: '-->',
  },
];

/** Renders one platform's full snippet file content, comments and all. */
export function renderSnippet(platform: SnippetPlatform): string {
  const tag = buildScriptTag({ src: WIDGET_SRC });
  const lines = [
    `${platform.commentOpen} Pulxon accessibility widget. Paste this into ${platform.installLocation}. ${platform.commentClose}`,
    `${platform.commentOpen} Before this works, upload the widget's files from the widget zip — pulxon.min.js and its fonts/ folder, kept together — to a /pulxon/ folder at the root of your own site, so this script tag's path resolves. See integrations/snippets/README.md in the Pulxon widget repository. ${platform.commentClose}`,
    `${platform.commentOpen} To set a site key, color, position or the other options this widget accepts, add the matching data-* attribute to the script tag below by hand — see integrations/snippets/README.md and packages/widget/src/config/options.ts in the Pulxon widget repository for the full list. ${platform.commentClose}`,
    tag,
    '',
  ];
  return lines.join('\n');
}
