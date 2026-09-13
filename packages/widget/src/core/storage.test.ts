import { describe, expect, it } from 'vitest';
import { createMemoryStorage, createSafeStorage } from './storage';

describe('createMemoryStorage', () => {
  it('stores and removes values', () => {
    const storage = createMemoryStorage();
    storage.set('a', '1');
    expect(storage.get('a')).toBe('1');
    storage.remove('a');
    expect(storage.get('a')).toBeNull();
  });
});

describe('createSafeStorage', () => {
  it('falls back to memory when localStorage access throws', () => {
    const win = {
      get localStorage(): Storage {
        throw new Error('denied');
      },
    } as unknown as Window;
    const storage = createSafeStorage(win);
    storage.set('a', '1');
    expect(storage.get('a')).toBe('1');
  });

  it('uses localStorage when available', () => {
    const storage = createSafeStorage(window);
    storage.set('pulxon:test', 'v');
    expect(window.localStorage.getItem('pulxon:test')).toBe('v');
    storage.remove('pulxon:test');
    expect(window.localStorage.getItem('pulxon:test')).toBeNull();
  });
});
