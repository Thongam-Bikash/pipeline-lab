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
