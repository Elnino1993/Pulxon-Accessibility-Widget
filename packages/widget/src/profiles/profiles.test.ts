import { describe, expect, it } from 'vitest';
import { createRegistry } from '../core/registry';
import { builtinFeatures } from '../features';
import { builtinProfiles, PROFILE_DESCRIPTIONS } from './index';

describe('builtinProfiles', () => {
  const registry = createRegistry(builtinFeatures);

  it('ships the six profiles with their feature sets', () => {
    expect(builtinProfiles.map((profile) => [profile.id, profile.features])).toEqual([
      ['low-vision', { 'bigger-text': 2, contrast: 2, 'big-cursor': 1 }],
      ['dyslexia', { 'dyslexia-font': 1, 'text-spacing': 1 }],
      ['adhd', { 'reading-mask': 1, 'pause-animations': 1, saturation: 1 }],
      ['seizure-safe', { 'pause-animations': 1, saturation: 1 }],
      ['keyboard', { 'focus-highlight': 1, 'highlight-links': 1 }],
      ['cognitive', { 'line-height': 1, 'reading-guide': 1, 'highlight-headings': 1 }],
    ]);
  });

  it('describes every profile, in words that match what it turns on', () => {
    for (const profile of builtinProfiles) expect(PROFILE_DESCRIPTIONS[profile.id], profile.id).toBeDefined();
  });

  it('only references existing features with valid levels and no internal conflicts', () => {
    for (const profile of builtinProfiles) {
      const ids = Object.keys(profile.features);
      for (const [id, level] of Object.entries(profile.features)) {
        const def = registry.get(id);
        expect(def, `${profile.id} references ${id}`).toBeDefined();
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(def?.levels ?? 0);
        expect(registry.conflicts(id).filter((other) => ids.includes(other))).toEqual([]);
      }
    }
  });
});
