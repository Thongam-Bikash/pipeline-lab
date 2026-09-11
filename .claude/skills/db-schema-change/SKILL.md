---
name: db-schema-change
description: Plans and writes safe, reversible database schema changes and data migrations using expand-migrate-contract, with locking analysis, backfill strategy, and rollback plan. Use this whenever the user mentions a migration, schema change, new column or table, dropping or renaming a column, changing a column type, adding an index or constraint, backfilling data, or a change to a persistence model or entity that implies the database must change. Also use when a deploy or release plan touches the database, since schema and code must be ordered relative to each other.
---

# Database Schema Change

Schema changes are the least reversible thing a backend engineer does routinely.
Application code can be rolled back in minutes; a dropped column cannot. On top
of that, a migration that is instant on a developer laptop can lock a large
production table for minutes. Both failure modes come from the same cause —
treating the migration as a single atomic edit rather than a sequence.

## Step 0 — Establish the facts

Before proposing anything, determine and state:

- Which database engine and version. Locking behaviour for the same statement
  differs between engines and between versions of the same engine — never rely
  on a remembered rule without confirming the target.
- The migration tool in use and how migrations are applied during deploy
  (before code, after code, manually, automatically on startup).
- Whether migrations are expected to be reversible, and whether existing
  migrations in the repo include down steps.
- Approximate row count and write rate of the affected tables. A change that is
  free at ten thousand rows may be an outage at fifty million.
- Whether more than one application version runs simultaneously during a
  deploy. If yes — rolling deploys, multiple services, canaries — old and new
  code must both work against every intermediate schema.

Read the most recent existing migrations before writing a new one, and follow
their conventions for naming, structure, and reversibility.

## The core rule: expand → migrate → contract

Never combine schema addition, data movement, and removal in one step. Split
into separately deployable phases:

1. **Expand** — add the new structure. Nullable or defaulted, no constraint yet.
   Nothing reads it. This phase is safe to deploy alone and safe to roll back.
2. **Migrate** — deploy code that writes both old and new, then backfill
   existing rows, then switch reads to the new structure. Each of these is its
   own deploy.
3. **Contract** — only after the new path has run in production long enough to
   trust, and after confirming nothing still reads the old structure, drop it.

The contract phase is a separate change on a later day. If the user wants
expand and contract in one release, push back and explain that it removes the
rollback path: once the old column is gone, reverting the code breaks it.

A rename is not an operation. It is: add new column → dual-write → backfill →
switch reads → drop old.

## Locking and long-running statements

Assume every statement takes a lock until proven otherwise, and that a lock on
a hot table is an outage. For each statement, state what lock it takes and how
long it will hold.

Common traps, to verify against your engine's docs rather than assume:

- Adding a column with a non-constant default may rewrite the whole table
- Adding a NOT NULL constraint to an existing column requires validating every
  row while holding a lock
- Adding a foreign key validates existing rows unless created as not-valid and
  validated separately
- Changing a column type usually rewrites and locks
- Index creation blocks writes unless the concurrent/online variant is used —
  and that variant typically cannot run inside a transaction
- A migration waiting for a lock queues every subsequent query behind it, so a
  slow migration behind a long-running read can stall the whole table

Mitigations: set a short lock timeout so the migration fails fast instead of
queueing traffic behind it, use the online/concurrent variant for indexes, and
add constraints in two phases (create unvalidated, then validate).

## Backfills

A backfill is a job, not a migration step. Running a single UPDATE across a
large table holds locks, bloats the transaction log, and cannot be paused.

Requirements for any backfill:

- Process in batches with a bounded size, committing each batch
- Be resumable — track progress so an interrupted run continues rather than
  restarting
- Be idempotent — safe to re-run over already-processed rows
- Be throttleable, and observable enough to see progress and stop it
- Leave new writes correct while it runs, which is why dual-write comes first

State the expected duration. A backfill measured in hours needs a plan for what
happens when it is still running at the next deploy.

## Data integrity

- Put invariants in the database as constraints, not only in application code.
  Application-level checks lose to concurrency; unique and foreign key
  constraints do not.
- Every foreign key needs a stated delete behaviour. Decide deliberately
  whether a referenced record can be deleted at all — in systems that keep
  historical records, soft-deletion or archival is usually correct, because
  hard-deleting a referenced entity destroys history that other records depend
  on.
- Index every column you filter, join, or sort on — and check the query plan
  rather than assuming the index is used.
- Avoid destructive updates to historical or audit tables. Append instead.

## Rollback plan

Every migration ships with an explicit answer to: *what do we do if this is
wrong in production?*

- Expand-phase changes: roll back the code, leave the schema. Safe.
- Backfills: state how to stop it and whether partially-migrated data is valid.
- Contract-phase changes: there is no rollback. Say so plainly, and confirm the
  waiting period and the check that nothing still reads the old structure.

If a down migration cannot faithfully restore state, say that instead of
writing a down step that silently loses data.

## Before reporting done

Run the migration against a realistic copy — not an empty schema — and report
the actual timing. Then run it a second time to confirm it fails cleanly or is
idempotent, and run the down step if one exists. Confirm the application boots
against the new schema *and* that the previous application version still works
against it, if rolling deploys are in play.
