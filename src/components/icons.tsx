import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Hourglass,
  Layers,
  BarChart3,
  Boxes,
  ClipboardList,
  Gauge,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  PlayCircle,
  RefreshCw,
  Route,
  ShieldCheck,
  Smartphone,
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
  smartphone: Smartphone,
  route: Route,
  versions: GitBranch,
  execution: PlayCircle,
  cases: ClipboardList,
  total: Layers,
  queue: Hourglass,
  active: Activity,
  feedback: AlertTriangle,
  review: Eye,
  approved: ShieldCheck,
  done: CheckCircle2,
  hold: Hourglass,
  overdue: Clock,
} as const;

export type NavIcon = keyof typeof NAV_ICONS;

export function NavGlyph({ name, ...props }: { name: NavIcon } & LucideProps) {
  const C = NAV_ICONS[name];
  return <C size={17} strokeWidth={1.8} aria-hidden="true" {...props} />;
}
