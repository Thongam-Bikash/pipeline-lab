---
name: api-endpoint
description: Designs and implements a backend API endpoint or service method contract-first, covering request/response shape, validation, authorization, error taxonomy, persistence, tests, and observability. Use this whenever the user asks to add, change, or expose an endpoint, route, controller, handler, resource, or RPC method — including phrasings like "add an API for X", "expose Y to the frontend", "we need a way to fetch/create/update Z", or when they paste a ticket describing new backend functionality. Also use when changing an existing endpoint's request or response shape, since that is a compatibility decision.
---

# API Endpoint

Building an endpoint is not "write a handler." Most production defects in this
area come from the parts people skip: authorization on the object (not just the
route), the error contract, and what happens on the second call with the same
payload. This skill forces those decisions to be explicit and early, while they
are still cheap to change.

## Step 0 — Learn the local shape before writing anything

Never write an endpoint from your general knowledge of the framework. Find the
two or three most similar existing endpoints and read them end to end, plus one
of their tests.

Extract and state back to the user before coding:

- Routing and handler style, and where the layer boundaries sit
  (handler / service / repository, or whatever this codebase actually uses)
- How request bodies are validated and where validation errors are produced
- The error response envelope — exact field names and status code mapping
- How authentication identity reaches the handler, and how object-level
  permission checks are performed
- Transaction boundaries: who opens one, and at which layer
- Test layout and how the test database or fixtures are set up
- Whether API docs are generated from code or hand-maintained

If two existing endpoints disagree, ask which is the intended pattern rather
than silently picking one. Picking wrong here propagates.

## Step 1 — Agree the contract before implementing

Write the contract first and get confirmation. This is the one-way door: the
handler body can be rewritten cheaply, but a shipped request/response shape has
consumers.

State it as:

```
METHOD  /path/{param}
Auth:      who may call this, and which object-level rule applies
Request:   field  type  required?  constraints
Response:  200 -> shape
Errors:    400 <condition>  403 <condition>  404 <condition>  409 <condition>
Idempotent: yes/no, and how repeat calls behave
Pagination: strategy + default and maximum page size (list endpoints only)
```

Rules that hold regardless of stack:

- **Never return the persistence model directly.** Return an explicit response
  type. Returning entities is how internal columns and future private fields
  leak to clients without anyone deciding to expose them.
- **404 vs 403 is a disclosure decision.** Returning 404 for objects the caller
  may not see prevents existence probing. Follow whatever the codebase already
  does — but if it is inconsistent, raise it.
- **Every list endpoint is paginated and bounded from day one.** Unbounded list
  endpoints are fine until the table grows, and then they are an outage.
- **Filters and sort fields are an allowlist**, never passthrough to the query
  layer.
- **Timestamps are unambiguous** — carry the timezone/offset, do not emit naive
  local times.
- **Money and quantities are exact types**, never floating point.

## Step 2 — Compatibility check for changes to existing endpoints

Adding an optional response field is safe. These are not, and require a
migration plan and explicit approval before you write code:

- Removing or renaming a field
- Narrowing a type, or making an optional request field required
- Changing the meaning of a field while keeping its name — the most dangerous
  one, because nothing fails loudly
- Changing a status code or error code for an existing condition
- Changing default sort order or pagination behaviour

Default strategy: add the new shape alongside the old, migrate consumers, then
remove. Identify the consumers by searching the codebase and asking about
external callers. "The frontend probably doesn't use it" is not a finding.

## Step 3 — Implement in this order

1. **Contract types** — request and response types, with validation declared
   the way this codebase declares it.
2. **Authorization** — both route-level (is this role allowed to call this at
   all) and object-level (is this caller allowed to touch *this* record). The
   second is the one that gets forgotten, and it is the one that turns a bug
   into a data breach. In systems with hierarchical or delegated permissions,
   write down the rule in one sentence before coding it.
3. **Business logic** — in the service layer, not the handler. Handlers parse
   and translate; they do not decide.
4. **Persistence** — check the generated query for N+1 access patterns and
   confirm an index supports every filter you exposed.
5. **Error mapping** — every failure path returns the documented code. No
   generic 500 for a condition you can predict.
6. **Observability** — a log line or metric that would let someone diagnose
   this at 3am without a reproduction. Never log credentials, tokens, or
   personal data.
7. **Docs** — regenerate or update, whichever this project uses.

## Step 4 — Correctness questions you must answer out loud

Do not skip these because the happy path works.

- **Idempotency**: what happens on retry after a client timeout? Any create or
  state-changing operation that a client may retry needs either a natural
  uniqueness constraint or an idempotency key. Retries are not hypothetical —
  clients, proxies, and job runners all retry.
- **Concurrency**: two callers hitting this simultaneously — is there a
  read-then-write window? If so, enforce it in the database (constraint,
  conditional update, or explicit locking), not by checking first in
  application code.
- **Partial failure**: if this writes to a database and then calls another
  system, what state is left when the second step fails? Decide: transaction,
  outbox, or compensating action. Do not leave it undefined.
- **Blast radius**: does this endpoint let one tenant, department, or manager
  reach another's data by manipulating an identifier?

## Step 5 — Tests

Cover, at minimum:

- Happy path, asserting the exact response shape
- Each validation failure, asserting the documented error code
- **Authorization negatives** — a caller who is authenticated but not permitted
  for this specific object. This is the highest-value test in the set and the
  one most often missing.
- Not-found behaviour
- The concurrency or idempotency case if the endpoint is state-changing

Test observable behaviour through the layer boundary, not internal method
calls. Tests coupled to implementation block the refactors they should protect.

## Definition of done

Do not report completion until you have actually run the build, the tests, and
the linter, and can say what you ran. If any step was skipped, say which and
why rather than implying full verification.
