import type { Ref } from 'preact';
import type { LauncherIcon, WidgetOptions } from '../config/options';

const ICON_PATHS: Record<LauncherIcon, string> = {
  person: 'M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM4 7.5 12 9l8-1.5.5 2L15 11v4l1.5 7h-2.2L12 16l-2.3 6H7.5L9 15v-4L3.5 9.5z',
  eye: 'M12 5C6.5 5 2.7 9.1 1.5 12c1.2 2.9 5 7 10.5 7s9.3-4.1 10.5-7C21.3 9.1 17.5 5 12 5zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  contrast: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2v16a8 8 0 0 1 0-16z',
};

export interface LauncherProps {
  options: WidgetOptions;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}

export function Launcher({ options, label, expanded, onToggle, buttonRef }: LauncherProps) {
  const classes = ['launcher', `launcher--${options.size}`, `launcher--${options.position}`];
  if (options.mobilePosition) classes.push(`launcher--m-${options.mobilePosition}`);
  return (
    <button
      ref={buttonRef}
      type="button"
      class={classes.join(' ')}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={expanded ? 'pulxon-panel' : undefined}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-icon={options.icon}>
        <path d={ICON_PATHS[options.icon]} />
      </svg>
    </button>
  );
}
