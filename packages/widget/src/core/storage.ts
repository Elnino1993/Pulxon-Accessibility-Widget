export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}

export function createSafeStorage(
  win: Window | undefined = typeof window === 'undefined' ? undefined : window,
): KeyValueStorage {
  try {
    const ls = win?.localStorage;
    if (!ls) return createMemoryStorage();
    const probe = '__pulxon_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      get: (key) => {
        try {
          return ls.getItem(key);
        } catch {
          return null;
        }
      },
      set: (key, value) => {
        try {
          ls.setItem(key, value);
        } catch {
          // Quota exceeded or storage blocked: settings stay in memory for this page view.
        }
      },
      remove: (key) => {
        try {
          ls.removeItem(key);
        } catch {
          // Storage blocked: nothing to remove.
        }
      },
    };
  } catch {
    return createMemoryStorage();
  }
}
