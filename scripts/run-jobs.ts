/** Run sheet sync + workload snapshot once (same as the cron endpoint). */
import { db } from '../src/server/db';
import { runJobs } from '../src/server/jobs';

runJobs()
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
