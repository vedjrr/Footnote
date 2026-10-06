'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icon';
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from './menu';
import { applyThemeChoice, readThemeChoice, type ThemeChoice } from './theme';

const labels: Record<ThemeChoice, string> = {
  system: 'Same as system',
  light: 'Light',
  dark: 'Dark',
};

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system');

  // The stored choice is only readable in the browser; the inline script has
  // already applied it, so this only syncs the menu.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readThemeChoice());
  }, []);

  function change(value: string) {
    const next = value as ThemeChoice;
    setChoice(next);
    applyThemeChoice(next);
  }

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Theme: ${labels[choice]}`}
        className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 hover:bg-wash data-[state=open]:bg-wash"
      >
        <span className="theme-icon-light">
          <Icon name="sun" size={20} />
        </span>
        <span className="theme-icon-dark">
          <Icon name="moon" size={20} />
        </span>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup value={choice} onValueChange={change}>
          {(Object.keys(labels) as ThemeChoice[]).map((c) => (
            <MenuRadioItem key={c} value={c}>
              {labels[c]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
