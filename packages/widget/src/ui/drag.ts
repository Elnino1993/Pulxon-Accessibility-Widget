import type { DragSpot } from '../core/store';

/** Gap kept between a dragged element and the viewport's edges, in px. */
export const EDGE = 8;

/** Gap between the launcher and the panel that opens beside it, in px. */
const ANCHOR_GAP = 8;

/** How far a pointer has to travel before a press counts as a drag rather than a click, in px. */
const DRAG_THRESHOLD = 5;

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  left: number;
  top: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The viewport a `position: fixed` element is laid out in, without the page's own scrollbar — the
 * scrollbar is not room the widget can use. Falls back to the window for a quirks-mode page, where
 * the root element reports the document's height instead.
 */
export function viewportOf(element: Element): Size {
  const root = element.ownerDocument.documentElement;
  const win = element.ownerDocument.defaultView;
  return {
    width: root.clientWidth || win?.innerWidth || 0,
    height: (element.ownerDocument.compatMode === 'CSS1Compat' ? root.clientHeight : 0) || win?.innerHeight || 0,
  };
}

export function sizeOf(element: HTMLElement): Size {
  return { width: element.offsetWidth, height: element.offsetHeight };
}

function clamp(value: number, min: number, max: number): number {
  // `max < min` happens when the element is larger than the viewport: pin it to `min`, the top-left
  // edge, so its start (the header, the close button) stays reachable.
  return Math.max(min, Math.min(value, max));
}

/** The room an element can move in along each axis, never negative. */
function room(box: Size, viewport: Size): Size {
  return {
    width: Math.max(0, viewport.width - box.width - 2 * EDGE),
    height: Math.max(0, viewport.height - box.height - 2 * EDGE),
  };
}

/**
 * Pulls a box back inside the viewport, in whole pixels: a fractional offset blurs the panel's text,
 * and a spot's round trip can come back as 199.99999….
 */
export function clampPoint(point: Point, box: Size, viewport: Size): Point {
  return {
    left: Math.round(clamp(point.left, EDGE, viewport.width - box.width - EDGE)),
    top: Math.round(clamp(point.top, EDGE, viewport.height - box.height - EDGE)),
  };
}

/**
 * A stored spot, as a pixel position for the current viewport. Spots are fractions of the room the
 * element has to move in, not pixels, so a resized window or a rotated phone keeps it on screen in
 * the same relative place instead of stranding it past the new edge.
 */
export function spotToPoint(spot: DragSpot, box: Size, viewport: Size): Point {
  const free = room(box, viewport);
  return clampPoint({ left: EDGE + spot.x * free.width, top: EDGE + spot.y * free.height }, box, viewport);
}

export function pointToSpot(point: Point, box: Size, viewport: Size): DragSpot {
  const free = room(box, viewport);
  const fraction = (offset: number, span: number): number => (span > 0 ? clamp(offset / span, 0, 1) : 0);
  return { x: fraction(point.left - EDGE, free.width), y: fraction(point.top - EDGE, free.height) };
}

/**
 * Where the panel opens when the visitor has not dragged it anywhere: beside the launcher, on the
 * side facing the middle of the screen, so it never opens off the edge the launcher is hugging.
 */
export function anchorPanel(launcher: Rect, panel: Size, viewport: Size): Point {
  const onLeftHalf = (launcher.left + launcher.right) / 2 < viewport.width / 2;
  const onBottomHalf = (launcher.top + launcher.bottom) / 2 > viewport.height / 2;
  const left = onLeftHalf ? launcher.left : launcher.right - panel.width;
  const top = onBottomHalf ? launcher.top - ANCHOR_GAP - panel.height : launcher.bottom + ANCHOR_GAP;
  return clampPoint({ left, top }, panel, viewport);
}

export interface DragHandlers {
  /** Called on every move once the pointer has travelled past the threshold, with the distance from the press. */
  onMove: (dx: number, dy: number) => void;
  /** Called once when the pointer is released; `moved` is false for a press that never became a drag. */
  onEnd: (moved: boolean) => void;
}

/**
 * Follows one pointer from its `pointerdown` until it is released. The element captures the pointer,
 * so the drag keeps tracking when the pointer outruns the element or leaves the window.
 */
export function beginDrag(down: PointerEvent, element: HTMLElement, handlers: DragHandlers): void {
  const startX = down.clientX;
  const startY = down.clientY;
  let moved = false;
  try {
    element.setPointerCapture?.(down.pointerId);
  } catch {
    // A pointer the browser already released (or a synthetic one) cannot be captured; the drag still
    // works for as long as the pointer stays over the element.
  }

  const onMove = (event: PointerEvent): void => {
    if (event.pointerId !== down.pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved = true;
    handlers.onMove(dx, dy);
  };

  const finish = (event: PointerEvent): void => {
    if (event.pointerId !== down.pointerId) return;
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', finish);
    element.removeEventListener('pointercancel', finish);
    try {
      element.releasePointerCapture?.(down.pointerId);
    } catch {
      // Already released.
    }
    handlers.onEnd(moved);
  };

  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', finish);
  element.addEventListener('pointercancel', finish);
}
