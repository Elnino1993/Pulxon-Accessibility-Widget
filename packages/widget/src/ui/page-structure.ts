import type { MessageKey } from '../i18n';

export interface StructureItem {
  id: number;
  label: string;
  detail: string;
  detailKey?: MessageKey;
  level?: number;
  element: HTMLElement;
}

const MAX_LABEL = 120;
const EXCLUDED = '[data-pulxon-ignore],[hidden],[aria-hidden="true"]';
const SECTIONING = 'article,aside,main,nav,section';
const LANDMARK_SELECTOR =
  'header,nav,main,aside,footer,form,section,search,[role="banner"],[role="navigation"],[role="main"],' +
  '[role="complementary"],[role="contentinfo"],[role="search"],[role="region"],[role="form"]';
const FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex]';

const ROLE_KEYS: Record<string, MessageKey> = {
  banner: 'landmark.banner',
  navigation: 'landmark.navigation',
  main: 'landmark.main',
  complementary: 'landmark.complementary',
  contentinfo: 'landmark.contentinfo',
  search: 'landmark.search',
  region: 'landmark.region',
  form: 'landmark.form',
};

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
}

function labelledByText(el: Element): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  const doc = el.ownerDocument;
  return clean(
    ids
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent ?? '')
      .join(' '),
  );
}

export function accessibleName(el: Element): string {
  return clean(el.getAttribute('aria-label')) || labelledByText(el) || clean(el.textContent) || clean(el.getAttribute('title'));
}

function isExcluded(el: Element): boolean {
  return el.closest(EXCLUDED) !== null;
}

export function collectHeadings(doc: Document): StructureItem[] {
  const items: StructureItem[] = [];
  doc.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[role="heading"]').forEach((el) => {
    if (isExcluded(el)) return;
    const label = accessibleName(el);
    if (!label) return;
    const ariaLevel = Number.parseInt(el.getAttribute('aria-level') ?? '', 10);
    const tagLevel = Number.parseInt(/^H([1-6])$/.exec(el.tagName)?.[1] ?? '', 10);
    const raw = el.getAttribute('role') === 'heading' || !Number.isFinite(tagLevel) ? ariaLevel : tagLevel;
    const level = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 6) : 2;
    items.push({ id: items.length, label, detail: `H${level}`, level, element: el });
  });
  return items;
}

function landmarkRole(el: Element): string | null {
  const explicit = el.getAttribute('role');
  if (explicit) return Object.prototype.hasOwnProperty.call(ROLE_KEYS, explicit) ? explicit : null;
  const named = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
  switch (el.tagName) {
    case 'NAV':
      return 'navigation';
    case 'MAIN':
      return 'main';
    case 'ASIDE':
      return 'complementary';
    case 'SEARCH':
      return 'search';
    case 'HEADER':
      return el.parentElement?.closest(SECTIONING) ? null : 'banner';
    case 'FOOTER':
      return el.parentElement?.closest(SECTIONING) ? null : 'contentinfo';
    case 'SECTION':
      return named ? 'region' : null;
    case 'FORM':
      return named ? 'form' : null;
    default:
      return null;
  }
}

export function collectLandmarks(doc: Document): StructureItem[] {
  const items: StructureItem[] = [];
  doc.querySelectorAll<HTMLElement>(LANDMARK_SELECTOR).forEach((el) => {
    if (isExcluded(el)) return;
    const role = landmarkRole(el);
    const detailKey = role ? ROLE_KEYS[role] : undefined;
    if (!role || !detailKey) return;
    const label = clean(el.getAttribute('aria-label')) || labelledByText(el);
    items.push({ id: items.length, label, detail: role, detailKey, element: el });
  });
  return items;
}

function linkDetail(link: HTMLAnchorElement): string {
  try {
    const url = new URL(link.href);
    return url.origin === link.ownerDocument.location.origin ? `${url.pathname}${url.hash}` : url.hostname;
  } catch {
    return clean(link.getAttribute('href'));
  }
}

export function collectLinks(doc: Document): StructureItem[] {
  const items: StructureItem[] = [];
  doc.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((el) => {
    if (isExcluded(el)) return;
    const label = accessibleName(el) || clean(el.getAttribute('href'));
    items.push({ id: items.length, label, detail: linkDetail(el), element: el });
  });
  return items;
}

export function focusElement(el: HTMLElement): void {
  if (!el.matches(FOCUSABLE)) el.setAttribute('tabindex', '-1');
  el.scrollIntoView?.({ block: 'center' });
  el.focus({ preventScroll: true });
}
