import { shouldRunSchedule } from './data-utils.mjs';
process.stdout.write(String(process.env.GITHUB_EVENT_NAME !== 'schedule' || shouldRunSchedule(process.env.SCHEDULE_CRON)));
