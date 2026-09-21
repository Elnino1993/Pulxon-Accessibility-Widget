import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Position } from '../config/options';
import type { Controller } from '../core/controller';
import type { FeatureDefinition, ProfileDefinition } from '../core/registry';
import type { DragSpot, Settings, SettingsStore } from '../core/store';
import { voiceCommandsForLang } from '../features/voice-navigation';
import type { Translator } from '../i18n';
import { beginDrag, clampPoint, pointToSpot, sizeOf, spotToPoint, viewportOf, type Point } from './drag';
import { FeatureButton, ModeButton } from './FeatureButton';
import { FontSizeStepper } from './FontSizeStepper';
import { handleTrapKeydown } from './focus-trap';
import { TileIcon, UiIcon } from './icons';
import { FONT_SIZE_FEATURE, placedFeatures, SECTIONS, type SectionSpec, type TileSpec } from './layout';
import { PageStructure } from './PageStructure';
import { LanguageAndSize, PositionAndReset } from './PanelSettings';
import { ProfileCard } from './ProfileCard';
import { Section } from './Section';

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
  /** The embed's configured corner; passed through to the position picker for its pressed state. */
  optionsPosition: Position;
  profiles: ProfileDefinition[];
  /** The screen edge the panel docks to while it has no spot of its own: the launcher's side. */
  side: 'left' | 'right';
  /** Where the visitor dragged the panel. While set, it floats there instead of docking. */
  spot: DragSpot | null;
  /** Called once a drag of the title bar ends, with where the panel was dropped. */
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
  side,
  spot,
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
  // Where the floating panel sits; unused while it is docked.
  const [point, setPoint] = useState<Point | null>(null);
  // Set only while the title bar is being dragged: placement leaves the panel wherever the pointer has it.
  const dragPoint = useRef<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const floating = dragging || spot !== null;

  const place = (): void => {
    const dialog = dialogRef.current;
    if (!dialog || !spot || dragPoint.current) return;
    const next = spotToPoint(spot, sizeOf(dialog), viewportOf(dialog));
    setPoint((current) => (current && current.left === next.left && current.top === next.top ? current : next));
  };

  // After every render, not just the first: a floating panel's height changes with its content (the
  // page structure view, the size setting), and its clamp inside the viewport with it.
  useLayoutEffect(place);

  useEffect(() => {
    const win = dialogRef.current?.ownerDocument.defaultView;
    const onResize = (): void => place();
    win?.addEventListener('resize', onResize);
    return () => win?.removeEventListener('resize', onResize);
  });

  const onHeaderPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    // The reset and close buttons and the Pulxon link sit in the title bar; pressing them must do
    // what they do, not start a drag.
    if ((event.target as Element | null)?.closest?.('button, a')) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const start = dialog.getBoundingClientRect();
    // Keeps the drag from selecting the title text instead of moving the panel.
    event.preventDefault();
    beginDrag(event, event.currentTarget as HTMLElement, {
      onMove: (dx, dy) => {
        // Measured on every move: the first move undocks the panel, which makes it shorter.
        const next = clampPoint({ left: start.left + dx, top: start.top + dy }, sizeOf(dialog), viewportOf(dialog));
        dragPoint.current = next;
        setDragging(true);
        setPoint(next);
      },
      onEnd: (moved) => {
        const dropped = dragPoint.current;
        dragPoint.current = null;
        if (moved && dropped) onDrop(pointToSpot(dropped, sizeOf(dialog), viewportOf(dialog)));
        setDragging(false);
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

  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const levelOf = (id: string): number => settings.features[id] ?? 0;
  const fontSize = byId.get(FONT_SIZE_FEATURE);

  // A feature the layout does not place (a future one, or a site's own) still gets a tile, in
  // Additional tools, rather than silently vanishing from the panel.
  const placed = placedFeatures();
  const unplaced: TileSpec[] = features.filter((feature) => !placed.has(feature.id)).map((feature) => ({ kind: 'feature', id: feature.id }));
  const sections: SectionSpec[] = SECTIONS.map((section) =>
    section.id === 'tools' ? { ...section, tiles: [...section.tiles, ...unplaced] } : section,
  );

  const renderTile = (tile: TileSpec) => {
    if (tile.kind === 'tool') {
      return (
        <button key={tile.id} ref={toolRef} type="button" class="tile" data-tool={tile.id} onClick={() => setView('structure')}>
          <TileIcon id={tile.id} />
          <span class="tile__label">{t('tool.pageStructure')}</span>
        </button>
      );
    }
    if (tile.kind === 'mode') {
      if (!byId.has(tile.feature)) return null;
      const active = levelOf(tile.feature) === tile.level;
      return (
        <ModeButton
          key={tile.id}
          id={tile.id}
          label={t(tile.labelKey)}
          active={active}
          onActivate={() => (active ? controller.disable(tile.feature) : controller.enable(tile.feature, tile.level))}
        />
      );
    }
    const feature = byId.get(tile.id);
    if (!feature) return null;
    return (
      <FeatureButton
        key={feature.id}
        feature={feature}
        level={levelOf(feature.id)}
        t={t}
        onActivate={(id) => controller.toggle(id)}
        describedById={noteIdFor(feature.id)}
      />
    );
  };

  const hasVoiceNavigation = byId.has('voice-navigation');
  const hasDictionary = byId.has('dictionary');

  const classes = floating ? 'panel panel--floating' : `panel panel--docked panel--${side}`;

  return (
    <div
      ref={dialogRef}
      id="pulxon-panel"
      class={classes}
      style={floating && point ? { left: `${point.left}px`, top: `${point.top}px` } : undefined}
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
        <button type="button" class="icon-button" data-pulxon-reset-icon aria-label={t('panel.reset')} onClick={() => controller.reset()}>
          <UiIcon id="reset" />
        </button>
        <button ref={closeRef} type="button" class="icon-button" aria-label={t('panel.close')} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/* The only part that scrolls: the title bar, with reset and close, stays in view. */}
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
            <LanguageAndSize t={t} settings={settings} store={store} onLangChange={onLangChange} />

            {profiles.length > 0 && (
              <Section id="profiles" title={t('panel.profiles')} info={t('info.profiles')} t={t}>
                <div class="profile-grid">
                  {profiles.map((profile) => {
                    const active = settings.profile === profile.id;
                    return (
                      <ProfileCard
                        key={profile.id}
                        profile={profile}
                        active={active}
                        t={t}
                        onToggle={() => controller.setProfile(active ? null : profile.id)}
                      />
                    );
                  })}
                </div>
              </Section>
            )}

            {sections.map((section) => {
              const tiles = section.tiles.map(renderTile).filter(Boolean);
              const stepper = section.id === 'content' && fontSize;
              if (tiles.length === 0 && !stepper) return null;
              return (
                <Section key={section.id} id={section.id} title={t(section.titleKey)} info={t(section.infoKey)} t={t}>
                  {stepper && (
                    <FontSizeStepper
                      level={levelOf(FONT_SIZE_FEATURE)}
                      t={t}
                      onChange={(level) => (level > 0 ? controller.enable(FONT_SIZE_FEATURE, level) : controller.disable(FONT_SIZE_FEATURE))}
                    />
                  )}
                  {tiles.length > 0 && <div class="grid">{tiles}</div>}
                  {section.id === 'visual' && hasVoiceNavigation && (
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
                  {section.id === 'tools' && hasDictionary && (
                    <p id={DICTIONARY_NOTE_ID} data-pulxon-dictionary-note class="feature-note">
                      {t('feature.dictionaryNote')}
                    </p>
                  )}
                </Section>
              );
            })}

            <PositionAndReset t={t} settings={settings} store={store} optionsPosition={optionsPosition} onReset={() => controller.reset()} />
          </>
        )}
      </div>

      {statementUrl && (
        <div class="panel__footer">
          <a data-pulxon-statement href={statementUrl} target="_blank" rel="noopener noreferrer">
            {t('panel.statement')}
            <span class="sr-only"> {t('link.newTab')}</span>
          </a>
        </div>
      )}
    </div>
  );
}
