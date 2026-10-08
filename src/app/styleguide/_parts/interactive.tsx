'use client';

import { useState } from 'react';
import { Button } from '@/ui/button';
import { DropArea } from '@/ui/drop-area';
import { Icon } from '@/ui/icon';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@/ui/menu';
import { Panel, Sheet } from '@/ui/panel';
import { Tag } from '@/ui/tag';
import { Tooltip } from '@/ui/tooltip';
import { Status } from '@/ui/notice';

export function MenuDemo() {
  const [period, setPeriod] = useState('mar');
  return (
    <Menu>
      <MenuTrigger asChild>
        <Tag label="Period" value={period === 'mar' ? 'March 2025' : 'Q1 2025'} />
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Period</MenuLabel>
        <MenuRadioGroup value={period} onValueChange={setPeriod}>
          <MenuRadioItem value="mar">March 2025</MenuRadioItem>
          <MenuRadioItem value="q1">Q1 2025</MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem hint="metric">Revenue</MenuItem>
        <MenuItem hint="dimension">Region</MenuItem>
        <MenuItem hint="value" disabled>
          West
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function TooltipDemo() {
  return (
    <Tooltip content="Copy SQL">
      <button
        type="button"
        aria-label="Copy SQL"
        className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 hover:bg-wash"
      >
        <Icon name="copy" size={20} />
      </button>
    </Tooltip>
  );
}

function PaperBody() {
  return (
    <div className="flex flex-col gap-4">
      <p className="type-small text-ink-2">Revenue is the sum of revenue.</p>
      <Status tone="good">Parts add up to the total.</Status>
      <Status tone="caution">March has two days with no rows.</Status>
    </div>
  );
}

export function PanelDemo() {
  const [panel, setPanel] = useState(false);
  const [sheet, setSheet] = useState(false);
  return (
    <div className="flex flex-wrap gap-4">
      <Button onClick={() => setPanel(true)}>Open panel</Button>
      <Button onClick={() => setSheet(true)}>Open sheet</Button>
      <Panel open={panel} onOpenChange={setPanel} title="1  Revenue, March 2025 against February">
        <PaperBody />
      </Panel>
      <Sheet open={sheet} onOpenChange={setSheet} title="1  Revenue, March 2025 against February">
        <PaperBody />
      </Sheet>
    </div>
  );
}

export function DropAreaDemo() {
  const [chosen, setChosen] = useState<string | null>(null);
  const props = {
    prompt: 'Drop a file here, or choose one.',
    chooseLabel: 'Choose a file',
    hint: chosen ? `Chose ${chosen}. Nothing is read here.` : 'Files up to 300 MB.',
    onFile: (file: File) => setChosen(file.name),
  };
  return (
    <div className="grid max-w-170 grid-cols-1 gap-8 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <p className="type-caption text-ink-3">Rest</p>
        <DropArea {...props} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="type-caption text-ink-3">A file dragged over it</p>
        <DropArea {...props} dragging />
      </div>
      <div className="flex flex-col gap-2">
        <p className="type-caption text-ink-3">Reading a file</p>
        <DropArea {...props} busy />
      </div>
    </div>
  );
}
