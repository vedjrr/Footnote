import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Moon,
  Plus,
  Search,
  Sun,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';

// The only icons the interface uses (ui-ux-rules §4). Each carries meaning.
const icons = {
  check: Check,
  caution: TriangleAlert,
  close: X,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  copy: Copy,
  download: Download,
  plus: Plus,
  search: Search,
  sun: Sun,
  moon: Moon,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;
export const iconNames = Object.keys(icons) as IconName[];

interface IconProps {
  name: IconName;
  size?: 16 | 20;
  /** Text equivalent. Without it the icon is hidden from assistive technology. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
  const Glyph = icons[name];
  return (
    <Glyph
      size={size}
      strokeWidth={1.5}
      absoluteStrokeWidth
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable={false}
    />
  );
}
