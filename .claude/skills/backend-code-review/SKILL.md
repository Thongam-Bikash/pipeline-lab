---
name: backend-code-review
description: Reviews backend code changes with a severity-ranked report covering correctness, concurrency, data integrity, authorization, failure handling, performance, and test quality. Use this whenever the user asks to review a pull request, diff, branch, commit, or file; asks "does this look right", "any issues with this", or "what am I missing"; or pastes backend code and asks for feedback. Also use before merging significant changes and when reviewing your own work prior to handing it back.
---

# Backend Code Review

A review that lists style opinions and misses a race condition is worse than no
review, because it creates confidence. Work through the categories below in
order of severity, and resist the pull toward the easy comments — naming and
formatting are the most visible issues in a diff and almost never the most
important.

## Step 0 — Establish context before commenting

Reading only the diff produces confident, wrong reviews. Before writing
anything:

- Read the changed files in full, not just the changed lines
- Find the callers of every modified function or endpoint
- Read the tests, including the ones that were *not* updated
- Check whether the change matches how this codebase already does this. Look
  at neighbouring code before calling something wrong — the codebase has
  conventions and history you do not have.
- Check the git history of anything that looks strangely written. Odd code
  usually has a reason; find the commit that explains it before recommending a
  rewrite.

If the change is large enough that you cannot hold it, say so and review it in
parts rather than skimming.

## Severity ranking

Label every finding. Lead with blockers; never open a review with nits.

```
[blocker]  correctness, data loss, security, broken contract, missing
           authorization — must not merge
[should]   design, maintainability, missing test, unclear failure behaviour —
           fix now or file it deliberately
[nit]      naming, style, formatting — clearly marked, easy to ignore
```

If the change is fine, say it is fine and stop. Padding a review with invented
concerns trains people to skim reviews.

## Category 1 — Correctness and data integrity (blockers)

- Off-by-one, boundary, and empty-collection handling
- Null and absent-value handling on every path, not just the happy one
- Exact types for money and quantities — never floating point
- Timezone handling: are instants stored in UTC, is a business-day or
  month-boundary rule applied in the right zone, does daylight saving break it
- Rounding: is it defined, consistent, and applied once rather than repeatedly
- Does the change preserve invariants the database enforces, and are new
  invariants enforced in the database rather than only in code
- Are historical or audit records mutated where they should be appended to

## Category 2 — Authorization and data exposure (blockers)

- Is there an object-level check, not merely a role check on the route
- Is scope enforced in the query, or applied after loading everything
- Does a response expose fields the caller should not see — especially where a
  persistence model is serialised directly
- Can identifiers in the request reach records outside the caller's scope
- Do filter, sort, and search parameters allow reaching restricted fields
- Do error messages confirm the existence of records the caller cannot read
- Is anything sensitive being logged, cached without a scope-aware key, or
  written to an export that skips the access rule

## Category 3 — Concurrency and failure (blockers)

- Read-then-write windows: is the invariant enforced by the database, or by a
  check that two concurrent callers can both pass
- Transaction boundaries: too wide (long locks), too narrow (partial writes),
  or opened at the wrong layer
- External calls inside transactions — the transaction holds locks for the
  duration of a network round trip, and cannot roll back the call
- Idempotency: what happens when this is retried after a timeout
- What state remains if the process dies between two writes
- Are retries applied only to transient failures, with backoff, and bounded
- Swallowed exceptions, bare catches, and fallbacks that hide failure. A
  caught-and-logged error that returns success is a data-loss bug wearing a
  disguise.
- Are timeouts set on every outbound call. Missing timeouts are how one slow
  dependency exhausts the whole thread or connection pool.

## Category 4 — Performance (usually should, occasionally blocker)

- N+1 access patterns, especially inside loops over collections
- Queries without a supporting index for their filter and sort columns
- Unbounded results: list endpoints, in-memory collections that grow with the
  data, batch jobs without a maximum
- Work in a request path that belongs in a background job
- Complexity that is fine at current volume and fatal at ten times it — say so
  now rather than after the incident

Performance claims need a number or a complexity argument. "This seems slow" is
not a review comment.

## Category 5 — Tests

- Does a new test actually fail without the change? An assertion that passes
  either way is worse than nothing.
- Are error paths and authorization negatives covered, or only the happy path
- Were existing tests modified to accommodate the change — and if so, was the
  test wrong, or is the change wrong? Loosened assertions are a red flag.
- Are tests coupled to implementation details that will break on refactor
- Are they deterministic — no dependence on wall-clock time, ordering, or
  shared mutable state between tests

## Category 6 — Change hygiene

- Is unrelated refactoring mixed into a functional change
- Is a schema change combined with the code that depends on it in a way that
  removes the rollback path
- Are new dependencies justified, and were they added to avoid writing a small
  amount of code
- Is there a feature flag on anything risky
- Would someone debugging this at 3am have the log line or metric they need
- Does anything here need a migration, a runbook update, or a note to another
  team

## Output format

```
## Summary
One or two sentences: what this change does and whether it is safe to merge.

## Blockers
- [file:line] Issue, why it matters, and a concrete fix.

## Should fix
- [file:line] Issue and suggested approach.

## Nits
- [file:line] Minor.

## What I could not verify
Anything you could not check — behaviour depending on production data,
external systems, or code you were not given.
```

That last section matters. State the limits of the review rather than implying
full coverage. A review that quietly skipped the parts it could not see is how
a blocker reaches production with an approval attached to it.
