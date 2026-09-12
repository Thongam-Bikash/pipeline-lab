import { describe, expect, it } from 'vitest'
import { isTooFrequent, nextRuns, parseCron } from './cron'

const values = (s: Set<number>) => [...s]
const iso = (dates: Date[]) => dates.map((d) => d.toISOString())

describe('parseCron', () => {
  it('expands steps, ranges, lists, and names', () => {
    const { fields, eitherDay } = parseCron('*/15 0-3 1,15 jan-mar MON-fri')
    expect(fields.map(values)).toEqual([[0, 15, 30, 45], [0, 1, 2, 3], [1, 15], [1, 2, 3], [1, 2, 3, 4, 5]])
    expect(eitherDay).toBe(true)
  })

  it('runs a single start value with a step to the end of the field', () => {
    expect(values(parseCron('5/20 * * * *').fields[0])).toEqual([5, 25, 45])
    expect(values(parseCron('10-20/5 * * * *').fields[0])).toEqual([10, 15, 20])
  })

  it('treats a starred day field as "any day" and trims spaces', () => {
    const { fields, eitherDay } = parseCron('  0 0 * DEC sun  ')
    expect(values(fields[3])).toEqual([12])
    expect(values(fields[4])).toEqual([0])
    expect(eitherDay).toBe(false)
  })

  it.each([
    ['* * * *', /needs 5 fields.*has 4/],
    ['60 * * * *', /"60" is not a valid minute\. Use 0-59,/],
    ['* * * * 7', /"7" is not a valid day of week\. Use 0-6 or sun-sat/],
    ['* * * mon *', /not a valid month\. Use 1-12 or jan-dec/],
    ['1,,2 * * * *', /not a valid minute/],
    ['*/0 * * * *', /not a valid minute/],
    ['*/x * * * *', /not a valid minute/],
    ['*/60 * * * *', /not a valid minute/],
    ['*/2/3 * * * *', /not a valid minute/],
    ['5-2 * * * *', /not a valid minute/],
    ['1-2-3 * * * *', /not a valid minute/],
    ['1.5 * * * *', /not a valid minute/],
  ])('rejects %s', (expr, message) => {
    expect(() => parseCron(expr)).toThrow(message)
  })
})

describe('isTooFrequent', () => {
  it.each([
    ['* * * * *', true],
    ['*/5 * * * *', false],
    ['0,2 * * * *', true],
    ['0,58 * * * *', true],
    ['0,30 * * * *', false],
    ['17 * * * *', false],
  ])('%s -> %s', (expr, expected) => {
    expect(isTooFrequent(parseCron(expr))).toBe(expected)
  })
})

describe('nextRuns', () => {
  const friday = new Date('2026-09-11T00:00:00Z')

  it('lists weekday runs in UTC by default', () => {
    expect(iso(nextRuns('0 3 * * 1-5', friday, 2))).toEqual(['2026-09-11T03:00:00.000Z', '2026-09-14T03:00:00.000Z'])
  })

  it('returns several runs in the same hour in order', () => {
    expect(iso(nextRuns('45,30 3 * * *', friday, 2))).toEqual(['2026-09-11T03:30:00.000Z', '2026-09-11T03:45:00.000Z'])
  })

  it('only returns runs strictly after the start time', () => {
    expect(iso(nextRuns('0 3 * * *', new Date('2026-09-11T03:00:00Z'), 1))).toEqual(['2026-09-12T03:00:00.000Z'])
    expect(iso(nextRuns('0 3 * * *', new Date('2026-09-11T02:59:30Z'), 1))).toEqual(['2026-09-11T03:00:00.000Z'])
  })

  it('applies the timezone option', () => {
    expect(iso(nextRuns('0 9 * * *', friday, 1, 'America/New_York'))).toEqual(['2026-09-11T13:00:00.000Z'])
  })

  it('advances a local time that daylight saving skips to the next valid time', () => {
    // 02:30 does not exist on 14 March 2027 in New York, so the run moves to 03:00.
    expect(iso(nextRuns('30 2 * * *', new Date('2027-03-13T12:00:00Z'), 1, 'America/New_York'))).toEqual(['2027-03-14T07:00:00.000Z'])
  })

  it('does not repeat a run when an advanced time is already scheduled', () => {
    expect(iso(nextRuns('0 2,3 * * *', new Date('2027-03-14T00:00:00Z'), 2, 'America/New_York'))).toEqual([
      '2027-03-14T07:00:00.000Z',
      '2027-03-15T06:00:00.000Z',
    ])
  })

  it('uses the first occurrence of a repeated hour, and the new offset after it', () => {
    // Clocks go back on 1 November 2026 in New York, so 01:30 happens twice.
    expect(iso(nextRuns('30 1 * * *', new Date('2026-11-01T00:00:00Z'), 1, 'America/New_York'))).toEqual(['2026-11-01T05:30:00.000Z'])
    expect(iso(nextRuns('0 3 * * *', new Date('2026-11-01T00:00:00Z'), 1, 'America/New_York'))).toEqual(['2026-11-01T08:00:00.000Z'])
  })

  it('runs on either day field when both are restricted', () => {
    expect(iso(nextRuns('0 0 13 * 5', new Date('2026-09-11T01:00:00Z'), 2))).toEqual(['2026-09-13T00:00:00.000Z', '2026-09-18T00:00:00.000Z'])
  })

  it('respects the month field', () => {
    expect(iso(nextRuns('0 0 1 jan *', friday, 1))).toEqual(['2027-01-01T00:00:00.000Z'])
  })

  it('returns nothing for a date that never exists', () => {
    expect(nextRuns('0 0 31 feb *', friday, 1)).toEqual([])
  })

  it('explains an unknown time zone', () => {
    expect(() => nextRuns('0 3 * * *', friday, 1, 'Mars/Olympus')).toThrow(/"Mars\/Olympus" is not a known time zone/)
  })
})
