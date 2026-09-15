# Changelog

Entries are added at the end of each phase.

## Phase 1 — Foundation (15 September 2026)

The simulator, the app around it, the first five modules, and the first two incident scenarios.

### Engine (`packages/engine`, kept at 100% coverage)

- Workflow loading built on GitHub's own parser and expression library, turning its errors into
  learner-facing diagnostics: the line, what is wrong, and how to fix it.
- Traps the parser does not catch: keys YAML reads as something other than text, such as `true:`,
  and version numbers like `3.10` that silently become 3.1.
- Trigger matching for push, pull request, manual dispatch, schedule, release, repository dispatch,
  and workflow call, with the documented filter rules and, when an event is skipped, the reason.
- Cron with IANA time zones, advancing a local time that daylight saving skips, as GitHub documents.
- Expressions and contexts, the four status functions, and a stubbed `hashFiles`.
- Matrix expansion with the documented exclude-then-include rules and the 256-job limit.
- A scheduler with a pure `advance()`: the needs graph, job and step conditions, continue-on-error,
  fail-fast, max-parallel, timeouts, outputs, job summaries, and annotations.
- One list of modelled keys drives the "not simulated" notices, so nothing is ignored in silence.

### App (`apps/web`)

- App shell, routing, an Auto/Light/Dark theme that persists, and progress kept in the browser.
- Run view: the pipeline graph, collapsible logs with timestamps, playback (pause, step, 1x, 4x,
  instant), and run history.
- Playground with a Monaco editor, schema completions, an event builder, and diagnostics that jump
  to the line they refer to.
- Lessons in MDX with annotated workflow examples and a quiz at the end of each one.
- Scenario pages with checks, progressive hints, and a debrief.
- Works from the keyboard alone, and fits a phone screen.

### Content

- Module 0 GitHub foundations, 1 what CI/CD is, 2 anatomy of a workflow, 3 triggers and filters,
  4 expressions and data. Nineteen lessons, each recording the date it was checked and the
  docs.github.com pages it was checked against.
- Scenario 1, works on my machine, and scenario 16, the 3 a.m. job. Tests prove each one starts
  unsolved and is solved by its reference solution.

### Delivery

- CI runs lint, typecheck, unit tests behind a 100% engine coverage gate, and Playwright, then
  builds and publishes the container image on every merge to `main`.
- Actions pinned to commit SHAs, base images pinned by digest, least-privilege permissions,
  concurrency groups, and secrets passed through `env` rather than string interpolation.
- **Not done yet:** the deploy job skips until the `SITE_URL` variable exists. Nothing has been
  deployed to a server, so the rollback path in `docs/DEPLOY.md` is still untested.

## Phase 2 — Accounts and sync (15 September 2026)

Accounts that keep progress and saved projects in step across devices, with the privacy basics that
come with holding personal data. Everything runs and is tested locally; nothing is deployed yet.

### API (`apps/api`)

- A Hono server on the page's own origin: the web container's Nginx passes `/api/` to it, and the Vite
  dev and preview servers do the same, so there is no CORS and no API address baked into the build.
- Better Auth: email and password with confirmation and password reset by email, Google sign-in
  wired but hidden until credentials exist, and account deletion. Rate limits on sign-in, sign-up
  and reset, with a test that every rule names an endpoint that really exists.
- Drizzle and Postgres 18. Better Auth's tables come from its CLI, and a one-shot container applies
  migrations before the API starts.
- One sync route: the browser sends what it has and gets back the merged state. The merge keeps the
  learner's best result per field (earliest completion, best score, fewest hints, newest project), so
  devices agree in any order. It runs only on the server and sits under the 100% coverage gate. A row
  lock stops two devices overwriting each other; with the lock removed, the concurrency test failed
  five runs out of five.
- A reset and a deleted project both hold when another device still has the old copy: a reset
  records its time, and a deleted project leaves an emptied marker.
- Input is validated at the boundary, timestamps are normalised to one UTC form, project writes are
  scoped to their owner with 404 for anyone else, and the export lists account columns one by one.

### App (`apps/web`)

- Sign in, sign up, forgotten and reset password, account and privacy pages.
- Guest progress and projects join the account on first sign-in. An answer that arrives after local
  progress changed is not adopted, a guest is never cleared, and signing out clears the browser.
- Saved Playground projects: save, open and delete, with the API's limits enforced before saving.
- The account page downloads everything the account stores and deletes the account, asking for the
  password again.
- The privacy page states what is really stored, including each session's IP address and browser,
  how long backups keep a copy, and that sign-up reveals whether an address is registered.
- Password reset links return to the page's own origin.
- Dialogs open in the middle of the screen. Since Phase 1 they had opened in the top-left corner.

### Delivery

- Compose gains the API, migrations, Postgres, an on-demand backup service, and Mailpit and MinIO for
  local use only. Every port stays on localhost, and the always-on services fit in 640 MB.
- Backups: `pg_dump` to S3-compatible storage with a 29-day expiry rule, and a restore drill that
  restores the newest backup into a scratch database and checks every table. Against MinIO, the
  restored row counts matched the live database.
- CI runs the API's route tests against a Postgres service container, runs 26 Playwright tests against
  the API, database and Mailpit started from the compose file, and builds both images.
- `docs/DEPLOY.md` covers configuration and secrets, the database, backups and the updated runbook;
  `docs/deploy-aws.md` describes the equivalent on AWS, as documentation only.

### Not done yet

- Nothing is deployed. There is still no server or domain, so TLS, the droplet runbook, the rollback
  drill, backups to Cloudflare R2 and the nightly schedule are all untried.
- Google sign-in has never been exercised: no credentials exist. The brief's test of signing in "with
  either method" on two devices is met for email and password only.
- Mail has only gone to Mailpit, so real delivery and SPF and DKIM records are untested.
- The web app asks for the password before deleting an account, but Better Auth still accepts a
  direct request from a session less than a day old without it.
- Resets and deletions compare each device's clock with the server's, so a device running minutes
  slow can lose a lesson finished just after a reset.
