// Field rules mirror the (unexported) validator in @actions/workflow-parser's model/converter/cron.js.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

type Field = { name: string; min: number; max: number; names?: string[] }

const FIELDS: Field[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: MONTHS },
  { name: 'day of week', min: 0, max: 6, names: DAYS },
]

export type Cron = {
  fields: [minute: Set<number>, hour: Set<number>, dom: Set<number>, month: Set<number>, dow: Set<number>]
  // When both day fields are restricted, a day matching either one runs (standard cron).
  eitherDay: boolean
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

function single(value: string, f: Field): number | undefined {
  const named = f.names?.indexOf(value.toLowerCase()) ?? -1
  if (named >= 0) return named + f.min
  if (!/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return n >= f.min && n <= f.max ? n : undefined
}

function bounds(value: string, f: Field): [number, number] | undefined {
  if (value === '*') return [f.min, f.max]
  const [a = '', b, ...rest] = value.split('-')
  const lo = single(a, f)
  const hi = b === undefined ? lo : single(b, f)
  if (rest.length || lo === undefined || hi === undefined || hi < lo) return undefined
  return [lo, hi]
}

function seq(lo: number, hi: number, by: number): number[] {
  return Array.from({ length: Math.floor((hi - lo) / by) + 1 }, (_, i) => lo + i * by)
}

function expand(value: string, f: Field): number[] | undefined {
  if (value.includes(',')) {
    const parts = value.split(',').map((v) => expand(v, f))
    return parts.every((p) => p !== undefined) ? (parts as number[][]).flat() : undefined
  }
  const [base = '', step, ...rest] = value.split('/')
  const range = bounds(base, f)
  if (!range || rest.length) return undefined
  if (step === undefined) return seq(range[0], range[1], 1)
  if (!/^\d+$/.test(step) || +step < 1 || +step > f.max) return undefined
  // A single start value with a step runs to the end of the field, e.g. 5/20 is 5,25,45.
  const end = base === '*' || base.includes('-') ? range[1] : f.max
  return seq(range[0], end, +step)
}

export function parseCron(expr: string): Cron {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`A cron schedule needs 5 fields (minute, hour, day of month, month, day of week), but "${expr}" has ${parts.length}.`)
  }
  const fields = parts.map((part, i) => {
    const f = FIELDS[i]!
    const values = expand(part, f)
    if (!values) {
      const names = f.names ? ` or ${f.names[0]}-${f.names[f.names.length - 1]}` : ''
      throw new Error(`"${part}" is not a valid ${f.name}. Use ${f.min}-${f.max}${names}, with *, commas, ranges, or steps.`)
    }
    return new Set(values)
  })
  return { fields: fields as Cron['fields'], eitherDay: !parts[2]!.startsWith('*') && !parts[4]!.startsWith('*') }
}

// Same check GitHub's parser uses: only the minute field decides the interval.
export function isTooFrequent(cron: Cron): boolean {
  const minutes = [...cron.fields[0]].sort((a, b) => a - b)
  const gaps = minutes.map((m, i) => (i === 0 ? m + 60 - minutes[minutes.length - 1]! : m - minutes[i - 1]!))
  return Math.min(...gaps) < 5
}

export function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
  } catch {
    throw new Error(`"${timeZone}" is not a known time zone. Use an IANA name such as "America/New_York".`)
  }
}

// Wall-clock time at an instant, expressed as if that local time were UTC.
function wallClock(fmt: Intl.DateTimeFormat, t: number): number {
  const p = Object.fromEntries(fmt.formatToParts(t).map((part) => [part.type, part.value]))
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute))
}

// First instant whose wall-clock time is at or after `wanted`, searching a known transition window.
function afterTransition(fmt: Intl.DateTimeFormat, lo: number, hi: number, wanted: number): number {
  while (hi - lo > MINUTE) {
    const mid = Math.floor((lo + hi) / 2 / MINUTE) * MINUTE
    if (wallClock(fmt, mid) >= wanted) hi = mid
    else lo = mid
  }
  return hi
}

function instantFor(fmt: Intl.DateTimeFormat, wanted: number): number {
  const early = wanted - (wallClock(fmt, wanted - DAY) - (wanted - DAY))
  const late = wanted - (wallClock(fmt, wanted + DAY) - (wanted + DAY))
  // A repeated hour resolves to its first occurrence.
  if (wallClock(fmt, early) === wanted) return early
  if (wallClock(fmt, late) === wanted) return late
  // Daylight saving skips this local time, so the run advances to the next valid one.
  return afterTransition(fmt, Math.min(early, late), Math.max(early, late), wanted)
}

export function nextRuns(expr: string, from: Date, count: number, timeZone = 'UTC'): Date[] {
  const {
    fields: [minuteField, hourField, dom, month, dow],
    eitherDay,
  } = parseCron(expr)
  const fmt = zonedFormatter(timeZone)
  const minutes = [...minuteField].sort((a, b) => a - b)
  const hours = [...hourField].sort((a, b) => a - b)
  const start = Math.floor(from.getTime() / MINUTE) * MINUTE

  const runs: Date[] = []
  let date = wallClock(fmt, start)
  date -= date % DAY
  // ponytail: walks up to ~5.7 years of calendar days; plenty for previewing a few runs
  for (let days = 0; days < 2100; days++, date += DAY) {
    const day = new Date(date)
    const onDom = dom.has(day.getUTCDate())
    const onDow = dow.has(day.getUTCDay())
    if (!month.has(day.getUTCMonth() + 1)) continue
    if (!(eitherDay ? onDom || onDow : onDom && onDow)) continue
    for (const hour of hours) {
      for (const minute of minutes) {
        const t = instantFor(fmt, date + hour * HOUR + minute * MINUTE)
        // An advanced time can land on one that is already scheduled.
        if (t <= start || t === runs[runs.length - 1]?.getTime()) continue
        runs.push(new Date(t))
        if (runs.length === count) return runs
      }
    }
  }
  return runs
}
