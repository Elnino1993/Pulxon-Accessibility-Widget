export type Listener<T> = (payload: T) => void;

export class Emitter<Events extends object> {
  private listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    const set = this.listeners[type] ?? new Set<Listener<Events[K]>>();
    set.add(listener);
    this.listeners[type] = set;
    return () => {
      set.delete(listener);
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners[type];
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        console.error('[pulxon] event listener failed', error);
      }
    }
  }

  clear(): void {
    this.listeners = {};
  }
}
