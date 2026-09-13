import type { FeatureDefinition } from '../core/registry';

const ID = 'highlight-links';

export const HIGHLIGHT_LINKS_CSS =
  'a[href]:not([data-pulxon-ignore] *),[role="link"]:not([data-pulxon-ignore] *)' +
  '{outline:3px solid #1f4bff!important;outline-offset:2px!important;' +
  'box-shadow:0 0 0 5px #ffffff!important;text-decoration:underline!important}';

export const highlightLinks: FeatureDefinition = {
  id: ID,
  group: 'navigation',
  labelKey: 'feature.highlightLinks',
  levels: 1,
  apply: ({ styles }) => styles.set(ID, HIGHLIGHT_LINKS_CSS),
  teardown: ({ styles }) => styles.remove(ID),
};
