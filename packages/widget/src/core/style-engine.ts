export type StyleMode = 'auto' | 'adopted' | 'style-tag';

export interface StyleEngine {
  set(id: string, css: string): void;
  remove(id: string): void;
  has(id: string): boolean;
  clear(): void;
}

export interface StyleEngineOptions {
  nonce?: string | null;
  mode?: StyleMode;
}

type Entry = { kind: 'sheet'; sheet: CSSStyleSheet } | { kind: 'tag'; el: HTMLStyleElement };

function supportsAdoptedStyleSheets(target: Document | ShadowRoot): boolean {
  return (
    'adoptedStyleSheets' in target &&
    typeof CSSStyleSheet === 'function' &&
    'replaceSync' in CSSStyleSheet.prototype
  );
}

export function createStyleEngine(
  target: Document | ShadowRoot,
  options: StyleEngineOptions = {},
): StyleEngine {
  const mode = options.mode ?? 'auto';
  const useAdopted = mode === 'adopted' || (mode === 'auto' && supportsAdoptedStyleSheets(target));
  const doc: Document = 'head' in target ? target : target.ownerDocument;
  const entries = new Map<string, Entry>();

  function container(): ParentNode {
    return 'head' in target ? target.head : target;
  }

  function set(id: string, css: string): void {
    const existing = entries.get(id);
    if (existing?.kind === 'sheet') {
      existing.sheet.replaceSync(css);
      return;
    }
    if (existing?.kind === 'tag') {
      existing.el.textContent = css;
      return;
    }
    if (useAdopted) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
      entries.set(id, { kind: 'sheet', sheet });
      return;
    }
    const el = doc.createElement('style');
    el.setAttribute('data-pulxon-style', id);
    if (options.nonce) el.nonce = options.nonce;
    el.textContent = css;
    container().appendChild(el);
    entries.set(id, { kind: 'tag', el });
  }

  function remove(id: string): void {
    const entry = entries.get(id);
    if (!entry) return;
    if (entry.kind === 'tag') {
      entry.el.remove();
    } else {
      target.adoptedStyleSheets = target.adoptedStyleSheets.filter((sheet) => sheet !== entry.sheet);
    }
    entries.delete(id);
  }

  function has(id: string): boolean {
    return entries.has(id);
  }

  function clear(): void {
    for (const id of [...entries.keys()]) remove(id);
  }

  return { set, remove, has, clear };
}
