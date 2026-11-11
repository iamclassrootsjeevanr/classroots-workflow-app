/** APK Testing: an APK version is one work item; its status follows its test results. Pure: no DB. */

/** The version's status from the statuses of its (live) test results. Same status keys as a result. */
export function versionStatus(results: readonly string[]): string {
  if (!results.length) return 'not_tested';
  const has = (...keys: string[]) => results.some(s => keys.includes(s));
  if (results.every(s => s === 'not_tested')) return 'not_tested';
  if (has('fail')) return 'fail';
  if (has('fixed', 'pending_retest')) return 'pending_retest';
  if (has('in_process', 'not_tested')) return 'in_process';
  // Everything is passed or not reported.
  return has('pass') ? 'pass' : 'not_reported';
}

/** A heads-up shown by Close version when tests are still not updated (closing is allowed anyway). */
export const versionCloseBlocker = (statuses: readonly string[]) => {
  const open = statuses.filter(s => s === 'not_tested' || s === 'in_process').length;
  return open ? `${open} test${open === 1 ? ' is' : 's are'} not updated yet.` : null;
};

