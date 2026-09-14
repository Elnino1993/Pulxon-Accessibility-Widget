import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { MessageKey, Translator } from '../i18n';
import { collectHeadings, collectLandmarks, collectLinks, type StructureItem } from './page-structure';

type Tab = 'headings' | 'landmarks' | 'links';

const TABS: readonly Tab[] = ['headings', 'landmarks', 'links'];

const COLLECTORS: Record<Tab, (doc: Document) => StructureItem[]> = {
  headings: collectHeadings,
  landmarks: collectLandmarks,
  links: collectLinks,
};

export interface PageStructureProps {
  t: Translator;
  doc: Document;
  onBack: () => void;
  onNavigate: (element: HTMLElement) => void;
}

export function PageStructure({ t, doc, onBack, onNavigate }: PageStructureProps) {
  const [tab, setTab] = useState<Tab>('headings');
  const backRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const items = useMemo(() => COLLECTORS[tab](doc), [tab, doc]);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  const selectTab = (next: Tab): void => {
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>): void => {
    const index = TABS.indexOf(tab);
    let next: Tab | undefined;
    if (event.key === 'ArrowRight') next = TABS[(index + 1) % TABS.length];
    else if (event.key === 'ArrowLeft') next = TABS[(index - 1 + TABS.length) % TABS.length];
    else if (event.key === 'Home') next = TABS[0];
    else if (event.key === 'End') next = TABS[TABS.length - 1];
    if (!next) return;
    event.preventDefault();
    selectTab(next);
  };

  return (
    <div class="structure">
      <button ref={backRef} type="button" class="back" onClick={onBack}>
        {t('structure.back')}
      </button>
      <h3 id="pulxon-structure-title">{t('tool.pageStructure')}</h3>
      <div class="tabs" role="tablist" aria-labelledby="pulxon-structure-title">
        {TABS.map((name) => (
          <button
            key={name}
            ref={(el) => {
              tabRefs.current[name] = el;
            }}
            type="button"
            role="tab"
            id={`pulxon-tab-${name}`}
            class="tab"
            aria-selected={tab === name}
            aria-controls="pulxon-structure-panel"
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={onTabKeyDown}
          >
            {t(`structure.${name}` as MessageKey)}
          </button>
        ))}
      </div>
      <div id="pulxon-structure-panel" role="tabpanel" aria-labelledby={`pulxon-tab-${tab}`} class="structure__panel">
        {items.length === 0 ? (
          <p>{t('structure.empty')}</p>
        ) : (
          <ul class="structure__list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  class="structure__item"
                  style={{ '--pulxon-indent': `${((item.level ?? 1) - 1) * 12}px` }}
                  onClick={() => onNavigate(item.element)}
                >
                  <span class="structure__detail">{item.detailKey ? t(item.detailKey) : item.detail}</span>
                  {item.label && <span class="structure__label">{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
