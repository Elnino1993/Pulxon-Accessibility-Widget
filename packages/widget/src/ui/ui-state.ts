export interface UiState {
  isOpen(): boolean;
  opener(): HTMLElement | null;
  setOpen(open: boolean, opener?: HTMLElement | null): void;
  subscribe(listener: (open: boolean) => void): () => void;
}

export function createUiState(): UiState {
  let open = false;
  let lastOpener: HTMLElement | null = null;
  const listeners = new Set<(open: boolean) => void>();

  return {
    isOpen: () => open,
    opener: () => lastOpener,
    setOpen: (next, opener = null) => {
      if (next === open) return;
      if (next) lastOpener = opener;
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
