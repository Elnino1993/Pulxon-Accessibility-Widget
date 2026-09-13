import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { VERSION } from './version';

describe('VERSION', () => {
  it('matches package.json version', () => {
    expect(VERSION).toBe(pkg.version);
  });
});
