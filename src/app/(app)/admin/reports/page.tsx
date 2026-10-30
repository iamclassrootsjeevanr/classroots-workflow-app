import { redirect } from 'next/navigation';

/** Reports moved to /reports (available to anyone with the Reports tick). */
export default function AdminReports() {
  redirect('/reports');
}
