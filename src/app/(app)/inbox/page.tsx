import { InboxList } from '@/components/inbox';
import { PageHeader, Tabs } from '@/components/ui';
import { requireUser } from '@/server/rbac';
import { listNotifications, unreadCount } from '@/server/services/notifications';

export const metadata = { title: 'Inbox' };

type Search = { tab?: string; q?: string };

/** Everything the app has told this person: deleted rows with Undo, assignments, feedback. */
export default async function InboxPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === 'unread' || sp.tab === 'read' ? sp.tab : 'all';
  const [items, unread] = await Promise.all([listNotifications(user.id, { tab, q: sp.q }), unreadCount(user.id)]);
  const href = (t: string) => `/inbox${t === 'all' ? '' : `?tab=${t}`}`;
  return (
    <>
      <PageHeader title="Inbox" subtitle={unread ? `${unread} unread` : 'You are all caught up'} />
      <Tabs
        active={href(tab)}
        items={[
          { href: href('all'), label: 'All' },
          { href: href('unread'), label: unread ? `Unread (${unread})` : 'Unread' },
          { href: href('read'), label: 'Read' },
        ]}
      />
      <form className="mb-4" action="/inbox">
        {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
        <input className="input" type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Search messages" aria-label="Search messages" />
      </form>
      <InboxList items={items} />
    </>
  );
}
