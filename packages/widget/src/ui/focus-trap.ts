const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function getFocusable(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('hidden'));
}

export function handleTrapKeydown(event: KeyboardEvent, container: HTMLElement, activeElement: Element | null): void {
  if (event.key !== 'Tab') return;
  const items = getFocusable(container);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const inside = activeElement !== null && container.contains(activeElement);
  if (event.shiftKey) {
    if (!inside || activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (!inside || activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
