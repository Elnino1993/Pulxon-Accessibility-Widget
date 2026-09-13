import type { Ref } from 'preact';
import type { WidgetOptions } from '../config/options';

export interface LauncherProps {
  options: WidgetOptions;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}

export function Launcher({ options, label, expanded, onToggle, buttonRef }: LauncherProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      class={`launcher launcher--${options.size} launcher--${options.position}`}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={expanded ? 'pulxon-panel' : undefined}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="4" r="2" />
        <path d="M4 7.5 12 9l8-1.5.5 2L15 11v4l1.5 7h-2.2L12 16l-2.3 6H7.5L9 15v-4L3.5 9.5z" />
      </svg>
    </button>
  );
}
