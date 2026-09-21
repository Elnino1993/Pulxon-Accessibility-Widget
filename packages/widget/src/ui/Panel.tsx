import type { JSX, RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Position } from '../config/options';
import type { Controller } from '../core/controller';
import { GROUP_ORDER, type FeatureDefinition, type ProfileDefinition } from '../core/registry';
import type { DragSpot, Settings, SettingsStore } from '../core/store';
import { voiceCommandsForLang } from '../features/voice-navigation';
import type { MessageKey, Translator } from '../i18n';
import { anchorPanel, beginDrag, clampPoint, EDGE, pointToSpot, sizeOf, spotToPoint, viewportOf, type Point } from './drag';
import { FeatureButton } from './FeatureButton';
import { handleTrapKeydown } from './focus-trap';
import { PageStructure } from './PageStructure';
import { PanelSettings } from './PanelSettings';
import { TileIcon } from './icons';

const VOICE_NOTE_ID = 'pulxon-voice-note';
const DICTIONARY_NOTE_ID = 'pulxon-dictionary-note';

/** Id of the note that describes a tile for assistive tech, when that feature has one. */
function noteIdFor(featureId: string): string | undefined {
  if (featureId === 'voice-navigation') return VOICE_NOTE_ID;
  if (featureId === 'dictionary') return DICTIONARY_NOTE_ID;
  return undefined;
}

export interface PanelProps {
  t: Translator;
  doc: Document;
  features: FeatureDefinition[];
  controller: Controller;
  settings: Settings;
  store: SettingsStore;
  lang: string;
  onLangChange: (lang: string | null) => void;
  /** The embed's configured corner; passed through to PanelSettings for its pressed-state fallback. */
  optionsPosition: Position;
  profiles: ProfileDefinition[];
  /** Where the visitor dragged the panel, or null to open it beside the launcher. */
  spot: DragSpot | null;
  /** The launcher the panel opens beside while it has no spot of its own. */
  anchorRef: RefObject<HTMLElement>;
  /** Called once a drag of the header ends, with where the panel was dropped. */
  onDrop: (spot: DragSpot) => void;
  branding: boolean;
  statementUrl: string | null;
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
  optionsPosition,
  profiles,
  spot,
  anchorRef,
  onDrop,
  branding,
  statementUrl,
  onClose,
  onNavigate,
}: PanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toolRef = useRef<HTMLButtonElement>(null);
  const returnToTool = useRef(false);
  const [view, setView] = useState<'main' | 'structure'>('main');
  const [point, setPoint] = useState<Point | null>(null);
  // Set only while the header is being dragged: placement leaves the panel wherever the pointer has it.
  const dragPoint = useRef<Point | null>(null);

  const place = (): void => {
    const dialog = dialogRef.current;
    if (!dialog || dragPoint.current) return;
    const box = sizeOf(dialog);
    const viewport = viewportOf(dialog);
    const anchor = anchorRef.current;
    let next: Point;
    if (spot) next = spotToPoint(spot, box, viewport);
    else if (anchor) next = anchorPanel(anchor.getBoundingClientRect(), box, viewport);
    else next = clampPoint({ left: EDGE, top: EDGE }, box, viewport);
    setPoint((current) => (current && current.left === next.left && current.top === next.top ? current : next));
  };

  // After every render, not just the first: the panel's height changes with its content (the page
  // structure view, the size setting), and a panel opened above the launcher has to move up with it.
  useLayoutEffect(place);

  useEffect(() => {
    const win = dialogRef.current?.ownerDocument.defaultView;
    const onResize = (): void => place();
    win?.addEventListener('resize', onResize);
    return () => win?.removeEventListener('resize', onResize);
  });

  const onHeaderPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    // The close button and the Pulxon link sit in the header; pressing them must do what they do,
    // not start a drag.
    if ((event.target as Element | null)?.closest?.('button, a')) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const start = dialog.getBoundingClientRect();
    const box = { width: start.width, height: start.height };
    // Keeps the drag from selecting the title text instead of moving the panel.
    event.preventDefault();
    beginDrag(event, event.currentTarget as HTMLElement, {
      onMove: (dx, dy) => {
        const next = clampPoint({ left: start.left + dx, top: start.top + dy }, box, viewportOf(dialog));
        dragPoint.current = next;
        setPoint(next);
      },
      onEnd: (moved) => {
        const dropped = dragPoint.current;
        dragPoint.current = null;
        if (moved && dropped) onDrop(pointToSpot(dropped, box, viewportOf(dialog)));
      },
    });
  };

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
      // A visitor pressing Escape to close the language dropdown (a native <select>'s own open
      // listbox) must not also close the whole panel underneath it — the event still reaches here
      // either way, so it's the select as the event's target, not "is the listbox open", that this
      // checks.
      if ((event.target as HTMLElement | null)?.tagName === 'SELECT') return;
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

  const activeProfile = profiles.find((profile) => profile.id === settings.profile);
  const hasVoiceNavigation = features.some((feature) => feature.id === 'voice-navigation');
  const hasDictionary = features.some((feature) => feature.id === 'dictionary');

  return (
    <div
      ref={dialogRef}
      id="pulxon-panel"
      class="panel"
      style={point ? { left: `${point.left}px`, top: `${point.top}px` } : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulxon-title"
      onKeyDown={onKeyDown}
    >
      <div class="panel__header" data-pulxon-drag-handle onPointerDown={onHeaderPointerDown}>
        <svg class="panel__grip" viewBox="0 0 10 16" aria-hidden="true" focusable="false">
          <circle cx="2" cy="2" r="1.5" />
          <circle cx="8" cy="2" r="1.5" />
          <circle cx="2" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="2" cy="14" r="1.5" />
          <circle cx="8" cy="14" r="1.5" />
        </svg>
        <div class="panel__heading">
          <h2 id="pulxon-title">{t('panel.title')}</h2>
          {branding && (
            <a
              data-pulxon-branding
              class="panel__brand"
              href="https://pulxon.com/?utm_source=widget"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('panel.poweredBy')}
              <span class="sr-only"> {t('link.newTab')}</span>
            </a>
          )}
        </div>
        <button ref={closeRef} type="button" class="icon-button" aria-label={t('panel.close')} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/* The only part that scrolls: the header, with the close button, stays in view. */}
      <div class="panel__body">
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
            {activeProfile && (
              <p data-pulxon-active-profile class="active-profile">
                {t('panel.activeProfile', { name: t(activeProfile.labelKey) })}
              </p>
            )}

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
                      describedById={noteIdFor(feature.id)}
                    />
                  ))}
                </div>
                {group === 'navigation' && hasVoiceNavigation && (
                  <>
                    <p id={VOICE_NOTE_ID} data-pulxon-voice-note class="feature-note">
                      {t('feature.voiceNavigationNote')}
                    </p>
                    <ul data-pulxon-voice-commands class="voice-commands">
                      {voiceCommandsForLang(lang).map((command) => (
                        <li key={command.id}>{command.phrases[0]}</li>
                      ))}
                    </ul>
                  </>
                )}
                {group === 'reading' && hasDictionary && (
                  <p id={DICTIONARY_NOTE_ID} data-pulxon-dictionary-note class="feature-note">
                    {t('feature.dictionaryNote')}
                  </p>
                )}
              </section>
            ))}

            <PanelSettings
              t={t}
              settings={settings}
              store={store}
              lang={lang}
              onLangChange={onLangChange}
              optionsPosition={optionsPosition}
            />
          </>
        )}

        <div class="panel__footer">
          <button type="button" class="reset" onClick={() => controller.reset()}>
            {t('panel.reset')}
          </button>
          {statementUrl && (
            <a data-pulxon-statement href={statementUrl} target="_blank" rel="noopener noreferrer">
              {t('panel.statement')}
              <span class="sr-only"> {t('link.newTab')}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
