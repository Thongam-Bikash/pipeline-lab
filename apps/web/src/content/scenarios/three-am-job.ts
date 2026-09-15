import { nextRuns, type Json } from '@pipeline-lab/engine'
import type { Scenario, ScenarioContext } from './types'

const ZONE = 'Europe/Berlin'
// Two reference dates, so a fixed UTC offset cannot pass: Berlin is +02:00 in June and +01:00 in December.
const SUMMER = new Date('2026-06-01T00:00:00Z')
const WINTER = new Date('2026-12-01T00:00:00Z')

const parts = (date: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )

function schedule(raw: Record<string, Json>): { cron?: string; timezone?: string } {
  const on = raw['on']
  if (!on || typeof on !== 'object' || Array.isArray(on)) return {}
  const entries = (on as Record<string, Json>)['schedule']
  const first = Array.isArray(entries) ? entries[0] : undefined
  if (!first || typeof first !== 'object' || Array.isArray(first)) return {}
  const cron = (first as Record<string, Json>)['cron']
  const timezone = (first as Record<string, Json>)['timezone']
  return { cron: typeof cron === 'string' ? cron : undefined, timezone: typeof timezone === 'string' ? timezone : undefined }
}

const upcoming = (context: ScenarioContext, from: Date, count: number): Date[] => {
  const { cron, timezone } = schedule(context.raw)
  if (!cron) return []
  return nextRuns(cron, from, count, timezone ?? 'UTC')
}

export const threeAmJob: Scenario = {
  id: 'three-am-job',
  order: 16,
  title: 'The 3 a.m. job',
  moduleSlug: 'triggers',
  story: [
    'You have joined a data team in Berlin. Every morning a report is supposed to be waiting when people arrive at 07:00, Monday to Friday.',
    'Instead it arrives at 09:00 in summer and 08:00 in winter, and it also runs at the weekend, which wakes the on-call phone for no reason.',
    'Fix the schedule so the report runs at 07:00 Berlin time on weekdays, in summer and in winter alike.',
  ],
  file: '.github/workflows/report.yml',
  starting: `name: Daily report
on:
  schedule:
    - cron: '0 7 * * *'
jobs:
  report:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - run: ./scripts/build-report.sh
      - run: echo "Report sent to the team" >> "$GITHUB_STEP_SUMMARY"
`,
  event: { type: 'schedule' },
  checks: [
    {
      id: 'seven-local',
      label: 'The report runs at 07:00 Berlin time, in summer and in winter',
      test: (context) => {
        const runs = [...upcoming(context, SUMMER, 3), ...upcoming(context, WINTER, 3)]
        if (runs.length < 6) return false
        return runs.every((run) => {
          const at = parts(run)
          return at['hour'] === '07' && at['minute'] === '00'
        })
      },
    },
    {
      id: 'weekdays-only',
      label: 'It does not run at the weekend',
      test: (context) => {
        const runs = [...upcoming(context, SUMMER, 10), ...upcoming(context, WINTER, 10)]
        if (runs.length < 20) return false
        return runs.every((run) => !['Sat', 'Sun'].includes(parts(run)['weekday'] ?? ''))
      },
    },
    {
      id: 'still-every-weekday',
      label: 'It still runs every weekday, not just once a week',
      test: (context) => {
        const runs = upcoming(context, SUMMER, 5)
        if (runs.length < 5) return false
        const span = runs[4]!.getTime() - runs[0]!.getTime()
        // Five weekday runs span at most a week, once a weekend is included.
        return span <= 7 * 24 * 60 * 60 * 1000
      },
    },
  ],
  hints: [
    'Without a timezone, cron times are UTC. Berlin is one or two hours ahead, depending on the time of year, which is why the report drifts with the seasons.',
    'A schedule entry takes a timezone alongside its cron, written as an IANA name such as Europe/Berlin.',
    'The fifth cron field is the day of week. 1-5 is Monday to Friday.',
  ],
  debrief: [
    'Subtracting an hour from the cron would have fixed the summer and broken the winter. The timezone option exists precisely so the schedule follows local time through daylight saving.',
    'Worth knowing for the next time: during a spring-forward change a local time that does not exist advances to the next valid time, so a 02:30 job runs at 03:00 rather than being skipped.',
    'Scheduled workflows also run only from the default branch, and never more often than every five minutes.',
  ],
  solution: `name: Daily report
on:
  schedule:
    - cron: '0 7 * * 1-5'
      timezone: Europe/Berlin
jobs:
  report:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - run: ./scripts/build-report.sh
      - run: echo "Report sent to the team" >> "$GITHUB_STEP_SUMMARY"
`,
  lastVerified: '2026-09-15',
  sources: [
    'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule',
    'https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule',
  ],
}
