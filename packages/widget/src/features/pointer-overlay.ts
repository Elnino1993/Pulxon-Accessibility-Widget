export type OverlayPlacement = (elements: HTMLElement[], pointerY: number, viewportHeight: number) => void;

export function createPointerOverlay(
  doc: Document,
  classNames: readonly string[],
  place: OverlayPlacement,
): () => void {
  const win = doc.defaultView;
  const elements = classNames.map((className) => {
    const el = doc.createElement('div');
    el.className = className;
    el.setAttribute('data-pulxon-ignore', '');
    el.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(el);
    return el;
  });

  let frame = 0;
  let pointerY = (win?.innerHeight ?? 0) / 2;

  const render = (): void => {
    frame = 0;
    place(elements, pointerY, win?.innerHeight ?? 0);
  };

  const schedule = (y: number): void => {
    pointerY = y;
    if (frame !== 0 || !win) return;
    frame = win.requestAnimationFrame(render);
  };

  const onPointerMove = (event: PointerEvent): void => schedule(event.clientY);

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target as Element | null;
    if (!target || typeof target.getBoundingClientRect !== 'function') return;
    // Focus inside the widget surfaces on its zero-height host at the end of <body>; never follow it.
    if (typeof target.closest === 'function' && target.closest('[data-pulxon-ignore]')) return;
    const rect = target.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > (win?.innerHeight ?? 0)) return;
    schedule(rect.top + rect.height / 2);
  };

  doc.addEventListener('pointermove', onPointerMove, { passive: true });
  doc.addEventListener('focusin', onFocusIn);
  render();

  return () => {
    doc.removeEventListener('pointermove', onPointerMove);
    doc.removeEventListener('focusin', onFocusIn);
    if (frame !== 0 && win) win.cancelAnimationFrame(frame);
    frame = 0;
    for (const el of elements) el.remove();
  };
}
