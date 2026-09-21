import type { RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { LauncherIcon, Position, WidgetOptions } from '../config/options';
import type { DragSpot, WidgetScale } from '../core/store';
import { beginDrag, clampPoint, fallDuration, fallKeyframes, landingPoint, pointToSpot, sizeOf, spotToPoint, viewportOf, type Point } from './drag';

const ICON_PATHS: Record<LauncherIcon, string> = {
  person: 'M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM4 7.5 12 9l8-1.5.5 2L15 11v4l1.5 7h-2.2L12 16l-2.3 6H7.5L9 15v-4L3.5 9.5z',
  eye: 'M12 5C6.5 5 2.7 9.1 1.5 12c1.2 2.9 5 7 10.5 7s9.3-4.1 10.5-7C21.3 9.1 17.5 5 12 5zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  contrast: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2v16a8 8 0 0 1 0-16z',
};

/**
 * A drag that ends is followed by the browser's own `click` on the same button, which would open or
 * close the panel as if the visitor had tapped it. That click is swallowed: any click this soon
 * after a drag, unless a new press has started since. The new press matters: a finger drag often
 * produces no click at all, and without it the window would eat a real tap made right after.
 */
const CLICK_AFTER_DRAG_MS = 400;

export interface LauncherProps {
  options: WidgetOptions;
  /** The corner to render in: the visitor's own choice (`settings.ui.position`) when they made one,
   *  otherwise `options.position`. */
  position: Position;
  /** `options.mobilePosition`, or `null` once the visitor has chosen their own corner — their choice
   *  wins on narrow screens too instead of being clobbered by the embed's mobile override. */
  mobilePosition: Position | null;
  /** Where the visitor dragged the launcher; wins over `position` and `mobilePosition` while set. */
  spot: DragSpot | null;
  /** The panel's size setting, only so a resized launcher is re-clamped inside the viewport. */
  scale: WidgetScale;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  /** Called once a drag ends, with where the launcher landed. */
  onDrop: (spot: DragSpot) => void;
  /** Land without the falling animation: the visitor asked the OS or the widget for less motion. */
  reduceMotion: boolean;
  buttonRef: RefObject<HTMLButtonElement>;
}

export function Launcher({ options, position, mobilePosition, spot, scale, label, expanded, onToggle, onDrop, reduceMotion, buttonRef }: LauncherProps) {
  // Where a stored spot lands in this viewport; recomputed on resize.
  const [placed, setPlaced] = useState<Point | null>(null);
  // Where the launcher is while a drag is in progress.
  const [dragging, setDragging] = useState<Point | null>(null);
  const lastDragPoint = useRef<Point | null>(null);
  const suppressClickUntil = useRef(0);
  // How far the launcher has to fall once it is let go; played after the render that lands it.
  const pendingFall = useRef(0);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button || !spot) {
      setPlaced(null);
      return;
    }
    const place = (): void => setPlaced(spotToPoint(spot, sizeOf(button), viewportOf(button)));
    place();
    const win = button.ownerDocument.defaultView;
    win?.addEventListener('resize', place);
    return () => win?.removeEventListener('resize', place);
  }, [spot?.x, spot?.y, scale, options.size]);

  // The launcher is already drawn at its landing spot; the animation only shows it getting there.
  useLayoutEffect(() => {
    const distance = pendingFall.current;
    pendingFall.current = 0;
    const button = buttonRef.current;
    if (distance < 2 || reduceMotion || typeof button?.animate !== 'function') return;
    button.animate(fallKeyframes(distance), { duration: fallDuration(distance) });
  }, [placed]);

  const onPointerDown = (event: PointerEvent): void => {
    // A new press is a new gesture: its click is the visitor's, whatever the last drag did.
    suppressClickUntil.current = 0;
    if (event.button !== 0) return;
    const button = event.currentTarget as HTMLButtonElement;
    const start = button.getBoundingClientRect();
    const box = { width: start.width, height: start.height };
    beginDrag(event, button, {
      onMove: (dx, dy) => {
        const next = clampPoint({ left: start.left + dx, top: start.top + dy }, box, viewportOf(button));
        lastDragPoint.current = next;
        setDragging(next);
      },
      onEnd: (moved) => {
        const dropped = lastDragPoint.current;
        lastDragPoint.current = null;
        if (!moved || !dropped) return;
        suppressClickUntil.current = Date.now() + CLICK_AFTER_DRAG_MS;
        // It can be lifted anywhere, but let go it falls back to the bottom edge, where it keeps the
        // horizontal spot it was dropped at.
        const viewport = viewportOf(button);
        const landed = landingPoint(dropped, box, viewport);
        pendingFall.current = landed.top - dropped.top;
        // The landing spot takes over from the live drag position in the same render, so the
        // launcher does not jump back to its corner for a frame in between.
        setPlaced(landed);
        setDragging(null);
        onDrop(pointToSpot(landed, box, viewport));
      },
    });
  };

  const onClick = (): void => {
    if (Date.now() < suppressClickUntil.current) return;
    onToggle();
  };

  // `placed` rather than `spot ? placed : null`: right after a first drop, `placed` already holds the
  // drop point while the new spot is still on its way through the store.
  const free = dragging ?? placed;
  const classes = ['launcher', `launcher--${options.size}`];
  if (free) {
    classes.push('launcher--free');
    if (dragging) classes.push('launcher--dragging');
  } else {
    classes.push(`launcher--${position}`);
    if (mobilePosition) classes.push(`launcher--m-${mobilePosition}`);
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      class={classes.join(' ')}
      style={free ? { left: `${free.left}px`, top: `${free.top}px` } : undefined}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={expanded ? 'pulxon-panel' : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-icon={options.icon}>
        <path d={ICON_PATHS[options.icon]} />
      </svg>
    </button>
  );
}
