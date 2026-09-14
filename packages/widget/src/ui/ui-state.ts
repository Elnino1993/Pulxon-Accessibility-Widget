export interface UiState {
  isOpen(): boolean;
  opener(): HTMLElement | null;
  /** False when the panel closed because focus was moved into the page on purpose. */
  shouldReturnFocus(): boolean;
  setOpen(open: boolean, opener?: HTMLElement | null, returnFocus?: boolean): void;
  subscribe(listener: (open: boolean) => void): () => void;
}

export function createUiState(): UiState {
  let open = false;
  let lastOpener: HTMLElement | null = null;
  let returnFocus = true;
  const listeners = new Set<(open: boolean) => void>();

  return {
    isOpen: () => open,
    opener: () => lastOpener,
    shouldReturnFocus: () => returnFocus,
    setOpen: (next, opener = null, restoreFocus = true) => {
      if (next === open) return;
      if (next) {
        lastOpener = opener;
        returnFocus = true;
      } else {
        returnFocus = restoreFocus;
      }
      open = next;
      for (const listener of listeners) listener(open);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
