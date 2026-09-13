import { describe, expect, it } from 'vitest';
import { contrastRatio, readableOn, relativeLuminance } from './contrast';

describe('contrast helpers', () => {
  it('computes relative luminance of black and white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('computes the contrast ratio of black on white as 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
  });

  it('picks the higher-contrast foreground for an accent', () => {
    expect(readableOn('#1f4bff')).toBe('#ffffff');
    expect(readableOn('#ffd400')).toBe('#111111');
  });

  it('supports 3-digit hex colors', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
    expect(readableOn('#ff0')).toBe('#111111');
    expect(readableOn('#00f')).toBe('#ffffff');
  });
});
