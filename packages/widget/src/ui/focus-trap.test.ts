import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFocusable, handleTrapKeydown } from './focus-trap';

function build(): HTMLElement {
  document.body.innerHTML =
    '<div id="c"><button id="first">1</button><a id="mid" href="#x">2</a>' +
    '<button id="skip" disabled>x</button><button id="last">3</button></div><button id="outside">o</button>';
  return document.getElementById('c') as HTMLElement;
}

function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getFocusable', () => {
  it('returns enabled focusable elements in order', () => {
    const container = build();
    expect(getFocusable(container).map((node) => node.id)).toEqual(['first', 'mid', 'last']);
  });
});

describe('handleTrapKeydown', () => {
  it('wraps from last to first on Tab', () => {
    const container = build();
    const focusFirst = vi.spyOn(el('first'), 'focus');
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    handleTrapKeydown(event, container, el('last'));
    expect(event.defaultPrevented).toBe(true);
    expect(focusFirst).toHaveBeenCalledOnce();
  });

  it('wraps from first to last on Shift+Tab', () => {
    const container = build();
    const focusLast = vi.spyOn(el('last'), 'focus');
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    handleTrapKeydown(event, container, el('first'));
    expect(event.defaultPrevented).toBe(true);
    expect(focusLast).toHaveBeenCalledOnce();
  });

  it('pulls focus back in when it is outside the container', () => {
    const container = build();
    const focusFirst = vi.spyOn(el('first'), 'focus');
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    handleTrapKeydown(event, container, el('outside'));
    expect(focusFirst).toHaveBeenCalledOnce();
  });

  it('does not interfere in the middle or for other keys', () => {
    const container = build();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    handleTrapKeydown(tab, container, el('mid'));
    expect(tab.defaultPrevented).toBe(false);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    handleTrapKeydown(enter, container, el('last'));
    expect(enter.defaultPrevented).toBe(false);
  });
});
