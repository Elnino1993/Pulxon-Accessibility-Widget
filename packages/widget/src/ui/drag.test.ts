import { describe, expect, it, vi } from 'vitest';
import { anchorPanel, beginDrag, clampPoint, EDGE, fallDuration, fallKeyframes, landingPoint, pointToSpot, spotToPoint } from './drag';

const viewport = { width: 1000, height: 800 };

describe('spot <-> point', () => {
  it('maps the corners of the room an element has to move in', () => {
    const box = { width: 100, height: 50 };
    expect(spotToPoint({ x: 0, y: 0 }, box, viewport)).toEqual({ left: EDGE, top: EDGE });
    expect(spotToPoint({ x: 1, y: 1 }, box, viewport)).toEqual({ left: 1000 - 100 - EDGE, top: 800 - 50 - EDGE });
  });

  it('round-trips a point through a spot', () => {
    const box = { width: 100, height: 50 };
    const spot = pointToSpot({ left: 300, top: 200 }, box, viewport);
    expect(spotToPoint(spot, box, viewport)).toEqual({ left: 300, top: 200 });
  });

  it('keeps a spot on screen after the viewport shrinks, in the same relative place', () => {
    const box = { width: 52, height: 52 };
    const spot = pointToSpot({ left: 900, top: 700 }, box, viewport);
    const phone = { width: 390, height: 844 };
    const point = spotToPoint(spot, box, phone);
    expect(point.left).toBeGreaterThanOrEqual(EDGE);
    expect(point.left + box.width).toBeLessThanOrEqual(phone.width - EDGE);
    expect(point.top + box.height).toBeLessThanOrEqual(phone.height - EDGE);
  });

  it('returns a valid spot when there is no room to move at all', () => {
    const spot = pointToSpot({ left: 0, top: 0 }, { width: 2000, height: 2000 }, viewport);
    expect(spot).toEqual({ x: 0, y: 0 });
  });
});

describe('clampPoint', () => {
  it('pulls a dragged box back inside the viewport', () => {
    const box = { width: 100, height: 100 };
    expect(clampPoint({ left: -40, top: 5000 }, box, viewport)).toEqual({ left: EDGE, top: 800 - 100 - EDGE });
  });

  it('pins a box larger than the viewport to the top-left edge instead of pushing it off screen', () => {
    expect(clampPoint({ left: 300, top: 300 }, { width: 2000, height: 2000 }, viewport)).toEqual({ left: EDGE, top: EDGE });
  });
});

describe('anchorPanel', () => {
  const panel = { width: 360, height: 500 };

  it('opens above and to the right of a launcher in the bottom-left corner', () => {
    const launcher = { left: 20, top: 728, right: 72, bottom: 780 };
    const point = anchorPanel(launcher, panel, viewport);
    expect(point.left).toBe(20);
    expect(point.top + panel.height).toBeLessThanOrEqual(launcher.top);
  });

  it('opens below and to the left of a launcher in the top-right corner', () => {
    const launcher = { left: 928, top: 20, right: 980, bottom: 72 };
    const point = anchorPanel(launcher, panel, viewport);
    expect(point.left + panel.width).toBe(980);
    expect(point.top).toBeGreaterThanOrEqual(launcher.bottom);
  });

  it('never leaves the viewport, even when the panel is taller than the room beside the launcher', () => {
    const launcher = { left: 20, top: 300, right: 72, bottom: 352 };
    const point = anchorPanel(launcher, { width: 360, height: 780 }, viewport);
    expect(point.top).toBeGreaterThanOrEqual(EDGE);
    expect(point.top + 780).toBeLessThanOrEqual(800 - EDGE + 1);
  });
});

describe('beginDrag', () => {
  function pointer(type: string, x: number, y: number): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, button: 0 });
  }

  it('reports movement from the start point and says whether it counted as a drag', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onMove = vi.fn();
    const onEnd = vi.fn();
    beginDrag(pointer('pointerdown', 10, 10), el, { onMove, onEnd });
    el.dispatchEvent(pointer('pointermove', 40, 25));
    el.dispatchEvent(pointer('pointerup', 40, 25));
    expect(onMove).toHaveBeenLastCalledWith(30, 15);
    expect(onEnd).toHaveBeenCalledWith(true);
    el.remove();
  });

  it('treats a press that barely moves as a click, not a drag', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onMove = vi.fn();
    const onEnd = vi.fn();
    beginDrag(pointer('pointerdown', 10, 10), el, { onMove, onEnd });
    el.dispatchEvent(pointer('pointermove', 12, 11));
    el.dispatchEvent(pointer('pointerup', 12, 11));
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith(false);
    el.remove();
  });

  it('stops listening once the drag ends', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onMove = vi.fn();
    beginDrag(pointer('pointerdown', 0, 0), el, { onMove, onEnd: () => {} });
    el.dispatchEvent(pointer('pointerup', 0, 0));
    el.dispatchEvent(pointer('pointermove', 100, 100));
    expect(onMove).not.toHaveBeenCalled();
    el.remove();
  });
});

describe('falling', () => {
  const box = { width: 52, height: 52 };

  it('lands on the bottom edge, straight below where it was let go', () => {
    expect(landingPoint({ left: 300, top: 120 }, box, viewport)).toEqual({ left: 300, top: 800 - 52 - EDGE });
  });

  it('keeps a launcher dropped against a side edge on screen', () => {
    expect(landingPoint({ left: 5000, top: 120 }, box, viewport).left).toBe(1000 - 52 - EDGE);
  });

  it('takes longer for a longer drop, within bounds', () => {
    expect(fallDuration(50)).toBeLessThan(fallDuration(600));
    expect(fallDuration(0)).toBe(250);
    expect(fallDuration(100000)).toBe(900);
  });

  it('starts at the height it was dropped from and settles at its landing spot', () => {
    const frames = fallKeyframes(400);
    expect(frames[0]!.transform).toBe('translateY(-400px)');
    expect(frames[frames.length - 1]!.transform).toBe('translateY(0)');
  });

  it('never bounces more than 24px, however far it falls', () => {
    const bounce = fallKeyframes(5000).find((frame) => frame.offset === 0.85)!;
    expect(bounce.transform).toBe('translateY(-24px)');
  });
});

