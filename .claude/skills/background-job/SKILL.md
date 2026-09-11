---
name: background-job
description: Designs and implements background jobs, scheduled/cron tasks, queue consumers, batch runs, and other asynchronous processing, with idempotency, retry, failure isolation, and observability built in. Use this whenever the user mentions a scheduled task, cron, nightly or periodic run, batch process, queue, worker, consumer, event handler, async processing, bulk import or export, notification or reminder sending, or anything that must happen "in the background" or "on a schedule". Also use when moving existing synchronous work off a request path.
---

# Background Job

Background jobs fail differently from request handlers. Nobody is watching when
they run, there is no user to retry manually, and the same job may be triggered
twice — by a retry, a redeploy, or two instances waking at the same time. A job
written like a script that "just runs once" will eventually run twice, run
halfway, or stop running silently for weeks before anyone notices.

Assume from the start: **it will be retried, it will overlap with itself, it
will die halfway through, and nobody will be watching.**

## Step 0 — Read the existing pattern

Find an existing job in this codebase and read it plus its wiring. Determine:

- The scheduler or queue technology, and whether at-least-once or at-most-once
  delivery is provided
- How many application instances run, and whether scheduled work is coordinated
  between them or fires on every instance
- Where retries are configured, how many, with what backoff
- What happens to permanently failing work — dead letter queue, error table,
  or silent discard
- How jobs are monitored and how a failure reaches a human
- How jobs are triggered manually for testing or re-run

If scheduled work currently fires on every instance without coordination,
flag it — that is a latent duplicate-execution bug even if it has not bitten yet.

## Step 1 — Decide the delivery semantics before coding

State plainly which of these the job needs:

- **At-least-once, idempotent** — the default and usually correct choice.
  Duplicates are possible, so the work must be safe to repeat.
- **Exactly-once** — not actually available across process boundaries. If the
  user asks for it, translate it into at-least-once plus idempotency, and say
  so rather than pretending.
- **At-most-once** — only acceptable when losing an execution is preferable to
  repeating it, which is rare.

Then answer: *what happens if this runs twice with the same input?* If the
answer is "duplicate payments", "duplicate emails", "double-counted balance",
the job needs a uniqueness key enforced by the database — a processed-items
table, a unique constraint on the natural key, or a conditional update. Checking
"have I already done this?" in application code before acting is not sufficient
under concurrency.

## Step 2 — Design rules

**Isolate failure per item.** A batch that processes many records must not
abandon the remaining work because one record is malformed. Process each item
in its own transaction, collect failures, continue, and report a summary. The
opposite — one big transaction over the whole batch — means one bad row blocks
everyone and the transaction is huge and lock-heavy.

**Make it resumable.** Track progress durably so an interrupted run continues
rather than restarting from zero. A job that must complete in one pass will
eventually not.

**Bound the work.** Every job has a maximum batch size and a maximum runtime.
Unbounded jobs grow with the data until they overrun their own schedule.

**Prevent overlap.** If a run can exceed its own interval, take a lock or
guard so the next trigger skips or waits. Overlapping runs of the same job are
a classic source of duplicate processing.

**Never let a job silently do nothing.** Emit the count of items considered and
processed even when that count is zero. A job that fails by processing nothing
is invisible without this.

**Retry only what is retryable.** Transient failures — timeouts, connection
resets, rate limits — retry with exponential backoff and jitter. Deterministic
failures — validation errors, missing references — must not be retried; they
go straight to the failure path. Retrying a permanent error wastes the retry
budget and delays the alert.

**Handle time explicitly.** For anything date-driven, decide and document which
timezone defines the boundary, and how the run behaves on daylight-saving
transitions and month ends. Store instants in UTC; apply the business timezone
only where the business rule requires it. Never assume "midnight" is
unambiguous in a system with users in multiple regions.

**Make it re-runnable for a past period.** Sooner or later a scheduled run will
be missed or produce wrong output. A job that can only process "now" cannot be
corrected. Parameterise the period and allow a manual run for a specific range.

## Step 3 — Observability, which is not optional here

For every run, record: start, end, duration, items considered, items succeeded,
items failed, and a correlation identifier tying log lines to the run. Emit a
metric for failure count and for run duration.

Then answer two questions explicitly:

- How does a human find out this job **failed**?
- How does a human find out this job **did not run at all**?

The second is the one people forget. A failing job at least produces an error;
a job that stopped being scheduled produces nothing. Monitor for absence — a
freshness check or a heartbeat — not just for errors.

## Step 4 — Side effects that reach the outside world

For anything that sends messages, moves money, or calls a third party:

- Record that the side effect happened, in the same transaction as the state
  change where possible, or via an outbox pattern where not
- Never send from inside a transaction that may roll back after sending
- Rate-limit outbound volume; a batch of thousands of notifications sent as
  fast as possible is indistinguishable from an attack and will get throttled
  or blocked
- For anything with real-world consequence, support a dry-run mode that reports
  what *would* happen without doing it, and use it before the first real run

## Step 5 — Tests

- The job body as a plain callable, tested directly with fixture data — do not
  require the scheduler to test the logic
- **Running it twice over the same input produces the same end state.** This is
  the essential test.
- A failing item does not prevent the remaining items from being processed
- Empty input completes cleanly and reports zero
- Period boundaries: the first and last moment of the window, and a
  timezone-sensitive case if the job is date-driven

## Before reporting done

Run the job against realistic data volume, not three fixture rows, and report
the actual duration. State how it will be monitored, and what the first
production run should be watched for.
