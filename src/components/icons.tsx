import {
  BarChart3,
  Boxes,
  Gauge,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideProps,
} from 'lucide-react';

/** Navigation icons by key, so the server layout passes plain strings and client components look them up. */
export const NAV_ICONS = {
  overview: LayoutDashboard,
  dashboard: Gauge,
  items: ListChecks,
  reports: BarChart3,
  people: Users,
  roles: ShieldCheck,
  workTypes: Boxes,
  sync: RefreshCw,
  account: UserCircle,
} as const;

export type NavIcon = keyof typeof NAV_ICONS;

export function NavGlyph({ name, ...props }: { name: NavIcon } & LucideProps) {
  const C = NAV_ICONS[name];
  return <C size={17} strokeWidth={1.8} aria-hidden="true" {...props} />;
}
