import type { ProfileDefinition } from '../core/registry';
import type { Translator } from '../i18n';
import { PROFILE_DESCRIPTIONS } from '../profiles';
import { TileIcon } from './icons';

export interface ProfileCardProps {
  profile: ProfileDefinition;
  active: boolean;
  t: Translator;
  onToggle: () => void;
}

/**
 * A profile as a card: icon, name, what it turns on, and a switch. The whole card is the switch, so
 * the target is large; its name is the profile's name alone and the line under it is its
 * description, rather than one long accessible name.
 */
export function ProfileCard({ profile, active, t, onToggle }: ProfileCardProps) {
  const nameId = `pulxon-profile-${profile.id}`;
  const descId = `${nameId}-desc`;
  const descKey = PROFILE_DESCRIPTIONS[profile.id];
  return (
    <button
      type="button"
      role="switch"
      class="profile-card"
      data-profile={profile.id}
      aria-checked={active}
      aria-labelledby={nameId}
      aria-describedby={descKey ? descId : undefined}
      onClick={onToggle}
    >
      <span class="profile-card__top">
        <span class="profile-card__icon">
          <TileIcon id={profile.id} />
        </span>
        <span class="switch" aria-hidden="true">
          <span class="switch__knob" />
        </span>
      </span>
      <span id={nameId} class="profile-card__name">
        {t(profile.labelKey)}
      </span>
      {descKey && (
        <span id={descId} class="profile-card__desc">
          {t(descKey)}
        </span>
      )}
    </button>
  );
}
