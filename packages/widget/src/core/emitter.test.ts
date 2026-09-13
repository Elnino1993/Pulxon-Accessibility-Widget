import { describe, expect, it, vi } from 'vitest';
import { Emitter } from './emitter';

interface TestEvents {
  change: number;
  open: undefined;
}

describe('Emitter', () => {
  it('delivers payloads to listeners until unsubscribed', () => {
    const emitter = new Emitter<TestEvents>();
    const seen: number[] = [];
    const off = emitter.on('change', (n) => seen.push(n));
    emitter.emit('change', 1);
    off();
    emitter.emit('change', 2);
    expect(seen).toEqual([1]);
  });

  it('isolates failing listeners', () => {
    const emitter = new Emitter<TestEvents>();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const good = vi.fn();
    emitter.on('open', () => {
      throw new Error('boom');
    });
    emitter.on('open', good);
    emitter.emit('open', undefined);
    expect(good).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('clear removes all listeners', () => {
    const emitter = new Emitter<TestEvents>();
    const listener = vi.fn();
    emitter.on('change', listener);
    emitter.clear();
    emitter.emit('change', 5);
    expect(listener).not.toHaveBeenCalled();
  });
});
