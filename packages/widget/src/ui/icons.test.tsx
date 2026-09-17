import { describe, expect, it } from 'vitest';
import { builtinFeatures } from '../features';
import { builtinProfiles } from '../profiles';
import { hasIcon, ICON_IDS, TileIcon } from './icons';

describe('tile icons', () => {
  it('covers every built-in feature', () => {
    const missing = builtinFeatures.filter((feature) => !hasIcon(feature.id)).map((feature) => feature.id);
    expect(missing).toEqual([]);
  });

  it('covers every built-in profile', () => {
    const missing = builtinProfiles.filter((profile) => !hasIcon(profile.id)).map((profile) => profile.id);
    expect(missing).toEqual([]);
  });

  it('covers the page structure tool', () => {
    expect(hasIcon('page-structure')).toBe(true);
  });

  it('ships no icon nothing renders', () => {
    const known = new Set([...builtinFeatures.map((feature) => feature.id), ...builtinProfiles.map((profile) => profile.id), 'page-structure']);
    const orphans = ICON_IDS.filter((id) => !known.has(id));
    expect(orphans).toEqual([]);
  });

  it('renders nothing for an unknown id', () => {
    expect(TileIcon({ id: 'not-a-feature' })).toBeNull();
  });

  it('hides the icon from assistive technology, because the tile label is the accessible name', () => {
    const icon = TileIcon({ id: 'contrast' });
    expect(icon).not.toBeNull();
    expect(icon?.props['aria-hidden']).toBe('true');
    expect(icon?.props.focusable).toBe('false');
  });
});
