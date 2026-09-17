import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Controller } from '../core/controller';
import { GROUP_ORDER, type FeatureDefinition, type ProfileDefinition } from '../core/registry';
import type { Settings, SettingsStore } from '../core/store';
import type { MessageKey, Translator } from '../i18n';
import { FeatureButton } from './FeatureButton';
import { handleTrapKeydown } from './focus-trap';
import { PageStructure } from './PageStructure';
import { PanelSettings } from './PanelSettings';
import { TileIcon } from './icons';

export interface PanelProps {
  t: Translator;
  doc: Document;
  features: FeatureDefinition[];
  controller: Controller;
  settings: Settings;
  store: SettingsStore;
  lang: string;
  onLangChange: (lang: string | null) => void;
  profiles: ProfileDefinition[];
  side: 'left' | 'right';
  branding: boolean;
  onClose: () => void;
  onNavigate: (element: HTMLElement) => void;
}

export function Panel({
  t,
  doc,
  features,
  controller,
  settings,
  store,
  lang,
  onLangChange,
  profiles,
  side,
  branding,
  onClose,
  onNavigate,
}: PanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toolRef = useRef<HTMLButtonElement>(null);
  const returnToTool = useRef(false);
  const [view, setView] = useState<'main' | 'structure'>('main');

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (view === 'main' && returnToTool.current) {
      returnToTool.current = false;
      toolRef.current?.focus();
    }
  }, [view]);

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    const root = dialog.getRootNode() as Document | ShadowRoot;
    handleTrapKeydown(event, dialog, root.activeElement);
  };

  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: features.filter((feature) => feature.group === group),
  })).filter((entry) => entry.items.length > 0);

  return (
    <div
      ref={dialogRef}
      id="pulxon-panel"
      class={`panel panel--${side}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulxon-title"
      onKeyDown={onKeyDown}
    >
      <div class="panel__header">
        <h2 id="pulxon-title">{t('panel.title')}</h2>
        <button ref={closeRef} type="button" class="icon-button" aria-label={t('panel.close')} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <PanelSettings t={t} settings={settings} store={store} lang={lang} onLangChange={onLangChange} />

      {view === 'structure' ? (
        <PageStructure
          t={t}
          doc={doc}
          onBack={() => {
            returnToTool.current = true;
            setView('main');
          }}
          onNavigate={onNavigate}
        />
      ) : (
        <>
          {profiles.length > 0 && (
            <section aria-labelledby="pulxon-profiles">
              <h3 id="pulxon-profiles">{t('panel.profiles')}</h3>
              <div class="grid">
                {profiles.map((profile) => {
                  const active = settings.profile === profile.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      class="tile"
                      data-profile={profile.id}
                      aria-pressed={active}
                      onClick={() => controller.setProfile(active ? null : profile.id)}
                    >
                      <TileIcon id={profile.id} />
                      <span class="tile__label">{t(profile.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div class="tools">
            <button
              ref={toolRef}
              type="button"
              class="tile tile--wide"
              data-tool="page-structure"
              onClick={() => setView('structure')}
            >
              <TileIcon id="page-structure" />
              <span class="tile__label">{t('tool.pageStructure')}</span>
            </button>
          </div>

          {groups.map(({ group, items }) => (
            <section key={group} aria-labelledby={`pulxon-group-${group}`}>
              <h3 id={`pulxon-group-${group}`}>{t(`group.${group}` as MessageKey)}</h3>
              <div class="grid">
                {items.map((feature) => (
                  <FeatureButton
                    key={feature.id}
                    feature={feature}
                    level={settings.features[feature.id] ?? 0}
                    t={t}
                    onActivate={(id) => controller.toggle(id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <div class="panel__footer">
        <button type="button" class="reset" onClick={() => controller.reset()}>
          {t('panel.reset')}
        </button>
        {branding && (
          <a href="https://pulxon.com/?utm_source=widget" target="_blank" rel="noopener noreferrer">
            {t('panel.poweredBy')}
            <span class="sr-only"> {t('link.newTab')}</span>
          </a>
        )}
      </div>
    </div>
  );
}
