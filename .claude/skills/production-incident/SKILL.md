---
name: production-incident
description: Structured triage and root-cause investigation for production problems — errors, latency, outages, stuck jobs, data anomalies, and "it works locally but not in production". Use this whenever the user reports something broken, slow, failing, timing out, or behaving unexpectedly in a deployed environment; pastes a stack trace, error log, or alert; asks why something is happening in production; or asks for help debugging an issue they cannot reproduce. Prioritises stopping impact before finding the cause.
---

# Production Incident

Two failure modes dominate incident response. The first is fixing the symptom
and declaring victory while the cause is still live. The second is investigating
elegantly for forty minutes while users remain broken. This skill separates
**stopping the bleeding** from **finding the cause**, and does them in that
order.

## Step 1 — Scope the impact first, in under five minutes

Before any hypothesis, establish:

- **What is broken, in user terms.** Not "the service is throwing errors" but
  "people cannot submit their timesheets."
- **How many are affected** — everyone, one region, one role, one customer, one
  record.
- **When it started**, and whether it is ongoing, intermittent, or resolved.
- **Is data being corrupted or lost right now?** This changes everything. If
  yes, stopping the process takes priority over understanding it.
- **What changed** — deploys, migrations, config or feature flag changes,
  dependency incidents, a scheduled job that just ran, or a date boundary such
  as a month or period end.

That last question resolves a large share of incidents on its own. Check it
early. If a deploy correlates in time, treat rollback as the leading option
rather than a last resort.

## Step 2 — Mitigate before you understand

You do not need the root cause to stop the damage. Legitimate mitigations:

- Roll back the recent deploy
- Turn off the feature flag
- Pause the job or queue consumer that is producing bad data
- Shed load or rate-limit the caller that is saturating the system
- Fail over, restart, or scale the affected component

Rolling back without knowing why is not a failure of rigour — the investigation
is easier when nothing is on fire. State clearly that the cause is still
unknown so nobody mistakes mitigation for resolution.

**Before any mitigation that touches data, capture evidence.** Restarts clear
in-memory state, rollbacks change the code you are reading, and pod recycling
loses local logs. Snapshot what you will need: the failing records, the log
window, thread or heap state if the process is stuck, the queue depth. Ten
seconds of capture saves an unresolvable postmortem.

## Step 3 — Investigate from evidence, not from memory

Work from what the system reports. Never guess at a cause and then look for
support — look at the data and let it narrow the field.

**Read the whole stack trace, from the bottom.** The deepest cause is at the
end of the chain; the top frame is usually just where it surfaced. Then find
the first occurrence in the logs, not the loudest one — the initial failure is
frequently different from the cascade it triggered.

**Use the correlation identifier** to follow one failing request end to end
rather than reading interleaved logs from every concurrent request.

**Compare working and failing cases.** One record works and another does not:
diff them. One region works and another does not: what differs in
configuration, data, or timezone. This is faster than reasoning about the code
in the abstract, and it is available even when you cannot reproduce locally.

**For latency, find where the time goes before theorising.** Slowness is
concentrated somewhere: a query, an external call, lock contention, garbage
collection, or a saturated pool. Measure the split before optimising anything.

Specific patterns worth checking early:

- **Pool exhaustion** — connection or thread pools drained because a dependency
  is slow and no timeout is set. Presents as total unresponsiveness with no
  obvious error.
- **A missing index meeting data growth** — a query that was fine for months
  crosses a threshold and degrades sharply.
- **N+1 amplification** — fine for a small account, catastrophic for a large one.
- **Retry storms** — a transient failure plus aggressive retries turns a blip
  into an outage and keeps the dependency down.
- **Duplicate execution** — a scheduled task firing on every instance, or a job
  retried after a timeout that had actually succeeded.
- **Timezone and boundary conditions** — failures clustered at midnight, month
  end, or a daylight-saving transition are almost always date-arithmetic bugs.
- **Environment divergence** — different config, different data volume,
  different locale, different clock, more than one instance. "Works locally" is
  usually one of these.

## Step 4 — Confirm the cause before fixing

State the hypothesis explicitly, then find evidence that would be *absent* if
it were wrong. A hypothesis consistent with the symptoms is not the same as a
confirmed cause, and fixing an unconfirmed cause produces incidents that
recur while everyone believes they are resolved.

If two explanations both fit, say so, and identify the observation that would
distinguish them.

If you have made three attempts without progress, stop and report what you have
ruled out and what evidence you still need. Do not keep changing things.

## Step 5 — Fix, and separate the fix from the cleanup

Distinguish three pieces of work and do not merge them:

1. **Mitigation** — already applied, restores service.
2. **The fix** — addresses the actual cause, with a regression test that fails
   without it.
3. **Data repair** — corrects records already damaged. This is a separate,
   reviewed, dry-runnable, idempotent job. Never a manual one-off statement run
   against production, and never combined with the code fix.

For data repair, state how many records are affected, how they were identified,
what the corrected values are, and how the change will be verified afterwards.
Repair scripts get one chance to be right.

## Step 6 — Close it out honestly

Record: what happened, user impact and duration, timeline, root cause,
mitigation, permanent fix, and how it was detected.

Then answer the two questions that produce actual improvement:

- **How would we detect this sooner?** If a human noticed before monitoring
  did, the monitoring gap is a finding in its own right.
- **What made this possible, beyond the immediate bug?** A missing timeout, an
  unbounded query, a job with no failure alert, a schema change deployed with
  its dependent code. The class of problem matters more than the instance.

Blame the system, not the person. "A change was deployed without a rollback
path" is useful; naming who deployed it is not.
