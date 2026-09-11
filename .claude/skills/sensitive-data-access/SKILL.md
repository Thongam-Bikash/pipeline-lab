---
name: sensitive-data-access
description: Enforces correct handling of sensitive and personal data — access control rules, field-level exposure, audit logging, retention, and safe logging/export. Use this whenever work touches personal, financial, health, contractual, or otherwise confidential records; whenever roles, permissions, hierarchy-based visibility, or "who can see what" is involved; and whenever data is exported, reported on, logged, cached, or copied to a non-production environment. Also use when adding a field to an existing response, since that is an exposure decision.
---

# Sensitive Data Access

Most data leaks are not break-ins. They are an endpoint that returned a field
nobody meant to expose, a log line that captured a payload, a report that
ignored the visibility rule the UI enforced, or a production dump copied into a
test environment. All of these are ordinary code written by people who were not
thinking about exposure at that moment.

This skill applies whenever the records involved describe **people** or their
money, contracts, health, performance, or private circumstances. Treat that
data as sensitive by default; the burden is on justifying exposure, not on
justifying protection.

## Step 0 — Classify before you write code

Name the fields involved and sort them into tiers. The exact tiers depend on
the domain, but the shape is consistent:

- **Public within the organisation** — name, role, team, work contact
- **Restricted** — home contact details, identifiers, dates of birth,
  emergency contacts, documents
- **Highly restricted** — compensation, bank details, government identifiers,
  health and medical information, disciplinary or grievance records,
  performance assessments, background checks

Then state, in one sentence per tier, who may read it and who may write it.
Get that confirmed before implementing. Almost every access-control bug traces
back to this sentence never having been written down.

## Step 1 — The access rule is about the object, not the endpoint

Role checks at the route are necessary and insufficient. The question is never
only "may this role call this?" but "may this caller see *this record*?"

Enumerate the relationships that grant access, for example: the record is about
the caller; the caller manages the subject, directly or transitively; the
caller holds a functional role scoped to a particular unit or region; the caller
is acting as a delegate while someone is absent.

Rules that hold generally:

- **Deny by default.** A caller with no matching relationship gets nothing.
  Never write access logic where the fallback branch grants access.
- **Enforce scope in the query, not after it.** Filter at the data layer so
  out-of-scope records are never loaded. Loading everything and filtering in
  application code leaks through counts, pagination totals, aggregate figures,
  and any code path that forgets the filter.
- **Transitive relationships terminate.** Hierarchy walks need a depth bound
  and cycle protection, or a malformed org structure becomes an infinite loop
  or a full-tree disclosure.
- **Self-access is a distinct case.** A person can usually read their own
  restricted data but must not write all of it. Being the subject of a record
  is not authority over it.
- **The privileged role is still scoped.** An administrative role usually has
  a boundary — a region, a legal entity, a business unit. Unscoped admin is a
  decision, not a default.
- **Delegation is time-bounded and logged**, and does not survive the
  delegating relationship ending.

## Step 2 — Field-level exposure

Access is not all-or-nothing per record. The same record commonly has fields
one caller may see and another may not.

- Build responses from an explicit allowlist per caller context. Never
  serialise the whole entity and remove fields afterwards — the next developer
  adds a field to the entity and it ships to everyone.
- Adding a field to an existing response is an exposure decision. Say which
  tier it belongs to and who will now be able to see it.
- Search, filter, and sort parameters must not accept restricted fields for
  callers who cannot read them. Sorting a list by a hidden field discloses its
  ordering; filtering on it discloses its value by inclusion or exclusion.
- Aggregates leak. A count, average, or total over a small group can reveal an
  individual value. Where the domain warrants it, apply a minimum group size
  before returning aggregate figures.
- Error messages and validation responses must not confirm the existence or
  content of records the caller cannot read.

## Step 3 — Logging, caching, and anywhere data goes sideways

- **Never log restricted or highly restricted values.** Log identifiers, not
  payloads. Assume request and response body logging is a leak by default and
  that debug logging left enabled will be read by people without clearance.
- Redact at the source, not at the log viewer. A redaction rule applied
  downstream fails the moment logs are shipped somewhere else.
- Exception messages and stack traces routinely embed parameter values —
  check what your error handler serialises.
- Cache keys must include the caller's authorisation scope, or one caller
  receives another's filtered results.
- Exports and reports must apply the same access rules as the interactive path.
  Report and export endpoints are the most common place where the rule is
  reimplemented and gets it wrong. Share the enforcement code rather than
  duplicating the logic.
- Files and documents need authorisation on the fetch itself. An unguessable
  URL is not access control.
- Non-production environments must not receive real personal data. Use
  synthetic or masked data. If a real dump is genuinely required, that is an
  approval decision, not an engineering convenience.

## Step 4 — Audit trail

For restricted and highly restricted data, record both reads and writes where
the domain calls for it: who, what record, which fields, when, from where, and
why if a reason is captured.

- Audit records are append-only. Nothing in the application updates or deletes
  them.
- Writes record before-and-after values so a disputed change can be
  reconstructed.
- The audit log is itself sensitive — it reveals who was looking at whom — and
  needs its own access rule.
- Retention for audit records is usually longer than for the data itself.
  Confirm the requirement rather than assuming.

## Step 5 — Retention, deletion, and lifecycle

- Access usually must end when a relationship ends — but the record is often
  retained for a legally mandated period afterwards. These are two different
  clocks; do not conflate them.
- Deletion requests interact with retention obligations. Where records must be
  kept, prefer anonymisation over deletion, and confirm which fields must
  survive.
- Hard-deleting a person's record typically breaks referential history in
  linked records. Decide the strategy deliberately and state what happens to
  the references.

## Step 6 — Tests

The negative tests are the ones that matter. Cover:

- An authenticated caller with no relationship to the record gets nothing
- A caller who may read a record still cannot read its restricted fields
- Restricted fields cannot be used as filter, sort, or search parameters by an
  unauthorised caller
- Scope boundaries: adjacent unit, adjacent region, a peer rather than a report
- A caller whose granting relationship has ended loses access
- Export and report paths enforce the same rule as the direct read path
- Log output for a request containing restricted data contains no such values

## When something is ambiguous

If it is unclear whether a particular caller should see a particular field, do
not guess and do not default to permissive. State the ambiguity, propose the
restrictive interpretation, and ask. An over-restrictive endpoint produces a
support ticket; an over-permissive one produces a disclosure incident that
cannot be undone.
