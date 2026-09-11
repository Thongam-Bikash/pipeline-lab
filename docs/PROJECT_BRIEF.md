# Pipeline Lab — Project Brief

## 1. What we are building

Pipeline Lab is an interactive web app that takes a developer from "I have never written a workflow" to "I can design, secure, debug, and defend a production CI/CD setup in an interview." It teaches through four things working together:

1. **Lessons** that explain one concept at a time with annotated, copyable workflow YAML.
2. **A workflow simulator** that runs in the browser: the learner edits YAML, fires an event (push, pull request, tag, schedule, manual dispatch), and watches jobs execute as a live dependency graph with realistic logs.
3. **Incident scenarios** based on things that really happen at companies: a slow pipeline, a breaking API change, a leaked secret, a compromised third-party action, a bad production deploy. The learner has to fix the workflow until the scenario's success checks pass.
4. **Companion GitHub repos** where the learner forks real projects and runs the same pipelines on real GitHub runners, so nothing stays theoretical.

## 2. Audience and outcome

The learner knows at least one programming language and has used git locally (commit, branch). Module 0 covers the GitHub side: pull requests, reviews, forks, and protected branches. They may have never touched CI/CD.

"Industry-ready" means that by the end, the learner can:

- Build CI for common frontend and backend stacks, including service containers for databases.
- Keep a separately-versioned frontend and backend in sync using schema checks, contract tests, and end-to-end tests, with cross-repo triggers.
- Deploy through staged environments with approvals, preview deployments, releases, and rollbacks.
- Harden workflows against real attack patterns (script injection, `pull_request_target` misuse, compromised actions, over-privileged tokens, long-lived cloud keys).
- Make pipelines fast and cheap (caching, parallelism, path filters, concurrency, runner choice) and reusable (reusable workflows, composite actions, custom actions).
- Debug failing and flaky pipelines methodically.
- Explain all of the above clearly in an interview.

## 3. Architecture

```
apps/
  web/             Vite + React app
    src/
      app/           Routes, providers, app shell
      components/ui/ Generic reusable components (Button, Dialog, Tabs, Callout)
      features/      One folder per feature (simulator, playground, lessons,
                     scenarios, progress), owning its components, hooks, and store
      content/
        modules/     One folder per module: lessons (MDX), examples (YAML), quiz (JSON)
        scenarios/   Scenario definitions (TS): starting files, event, step
                     outcome rules, success checks, hints, debrief
  api/             Phase 2: Hono API, Better Auth (email and Google), Drizzle + Postgres
packages/
  engine/          Pure TS simulator: parser, validator, trigger matcher, expression
                   evaluator, matrix expander, DAG scheduler, run model. No React.
infra/             Docker Compose and the host Nginx site for the droplet
.github/
  workflows/       This app's own CI, image build, and deploy
docs/              This brief, IDEAS.md, DEPLOY.md
```

Pages: a home page, a module index showing progress, lesson pages, scenario pages, a free-form **Playground** (simulator with a blank or template workflow), a cheat sheet, a glossary, interview prep, the capstone, a progress page with a reset option, and from Phase 2 sign-in and account pages.

**Accounts (Phase 2).** Everything works as a guest, with progress in localStorage. Signing in (email and password, or Google) syncs progress, saved playground projects, and settings; guest progress merges into the account on first sign-in. The simulator always runs in the browser; the API only stores learner data.

**Hosting.** The app runs in Docker on a DigitalOcean droplet that also hosts other services. The host's Nginx terminates TLS (Certbot) and proxies to the app's containers on localhost-only ports. Images are built in CI, pushed to GitHub Container Registry, and deployed over SSH, with rollback by image tag. From Phase 2, Cloudflare R2 holds database backups. `docs/deploy-aws.md` describes an equivalent AWS setup (documentation only).

## 4. The simulator engine

This is the heart of the app. Build it as a standalone, well-tested library first, then build UI on top.

### What it models

- **Parsing and validation.** Parse YAML with line numbers. Validate against a documented subset of the workflow schema and report errors the way a learner needs them: line, key, what is wrong, and how to fix it. Also flag common mistakes (tabs, wrong indentation of `steps`, `on:` parsed as boolean, missing `runs-on`).
- **Triggers.** `push` and `pull_request` with branch, tag, and path filters (including negation), `workflow_dispatch` with inputs, `schedule` (show the next run times, including the `timezone` option), `release`, `repository_dispatch`, and `workflow_call`. The event panel lets the learner build an event: which branch, which files changed, PR from a fork or not, tag name.
- **Expressions and contexts.** `${{ }}` evaluation for `github`, `env`, `vars`, `secrets`, `inputs`, `needs`, `matrix`, `steps`, `job`, `runner`. Functions: `success()`, `failure()`, `always()`, `cancelled()`, `contains`, `startsWith`, `endsWith`, `format`, `join`, `toJSON`, `fromJSON`, and a stubbed `hashFiles`. Job-level and step-level `if`.
- **Jobs.** Dependency graph from `needs`, parallel execution, job outputs passed through `needs.<job>.outputs`, `strategy.matrix` with `include`/`exclude`, `fail-fast`, `max-parallel`, `continue-on-error`, `timeout-minutes`.
- **Steps.** `uses` and `run` steps. The engine does not execute real code. Each step's outcome, duration, and log lines come from scenario rules or from a built-in library of well-known actions (checkout, setup-node, setup-python, setup-java, setup-go, cache, upload/download-artifact, docker build-push, etc.) that produce plausible logs.
- **Caching.** Simulated cache keys: first run misses, later runs hit if the key matches, and the step durations change accordingly so the learner can see the speedup.
- **Concurrency.** `concurrency` groups with `cancel-in-progress`, demonstrated by firing two events in quick succession.
- **Permissions and secrets.** A step that needs a permission (for example `contents: write` to push a tag, `id-token: write` for OIDC) fails with a realistic 403-style message when it was not granted. Secret values are masked as `***` in logs. Secrets are not available to workflows triggered from forks, just like on GitHub.
- **Environments.** Jobs with `environment:` pause at a "waiting for review" state; the learner clicks Approve or Reject. Environment-scoped secrets and variables.
- **Service containers.** Jobs with `services:` show containers starting, health checks, and connection logs.
- **Artifacts and summaries.** Artifacts listed on the run; `$GITHUB_STEP_SUMMARY` and `$GITHUB_OUTPUT` handled for simple `echo` patterns; annotations (`::error file=...::`) shown inline.

### The run view

The run view has three linked panes: the YAML editor, the job graph (the visual centerpiece), and the log viewer with collapsible step groups and timestamps. Clicking a job in the graph opens its logs; clicking a log error jumps to the related YAML line. Include playback controls (pause, step, speed 1x/4x/instant) and a run history so learners can compare runs before and after a fix.

Show a persistent, low-key note that this is a simulation of a documented subset, with a link to the matching companion repo to try it for real.

### Testing

Unit test every engine feature with small YAML fixtures and expected run results. The engine is where bugs would teach learners wrong things, so treat its tests as non-negotiable.

## 5. Design direction

The subject is software delivery pipelines: jobs, stages, flow, pass and fail, logs. The single memorable element should be the **live pipeline graph**; everything else stays quiet and disciplined so that the graph and the code are what the eye goes to.

Before writing UI code in Phase 1, propose a compact design plan: 4–6 named hex colors, typefaces and their roles, a layout concept with ASCII wireframes for the lesson page and the run view, and three or four principles. Then review the plan against these common generated-design defaults and revise anything that matches one without a specific reason:

- warm cream background with a high-contrast serif and a terracotta accent
- near-black background with a single acid-green accent
- identical rounded cards with the same soft shadow everywhere, and gradient washes as decoration
- all-caps eyebrow labels over every heading, `A · B · C` meta strings, and `→` appended to every link

Quality floor: responsive down to mobile (the run view may stack panes), visible keyboard focus, full keyboard operation of the simulator, `prefers-reduced-motion` respected, WCAG AA contrast, and light and dark themes. Job and step status must never rely on color alone; pair color with an icon and text. Write interface copy in plain, active, sentence-case language ("Run workflow", "Approve deployment").

Do not use GitHub's logo, the Octocat, or GitHub's own UI styling. The app teaches GitHub Actions but has its own identity.

## 6. Content rules

- Verify every syntax detail, action version, runner label, permission, and price against docs.github.com or the GitHub changelog at the time of writing, and record `lastVerified` on each lesson.
- Use the current major version of official actions. JavaScript actions now run on Node 24: GitHub began forcing Node 24 in June 2026 and removes Node 20 from runners on September 16, 2026, so any custom-action example must use `runs.using: node24`.
- In "production-grade" examples, pin third-party actions to full commit SHAs with a version comment, and explain why. In beginner examples, tags are fine but mention pinning.
- Pricing changes; do not hardcode dollar figures without checking. Context as of September 2026: GitHub cut hosted-runner prices by up to 39% on January 1, 2026; a proposed per-minute platform fee for self-hosted runners was announced for March 2026 and then postponed. Public repositories remain free. Re-verify before writing the cost lesson.
- Runner `-latest` labels migrate to new images over time (for example `windows-latest` moving to Visual Studio 2026 in June 2026, and a `macos-latest` migration starting mid-June 2026). Use this as a teaching point for pinning runner images.
- Every lesson ends with: a short recap, a quiz of 3–5 questions, and where relevant a "Try it for real" exercise in a companion repo.

## 7. Curriculum

Each module has 3–6 lessons, at least one simulator exercise, a quiz, and a module recap. Learning outcomes are listed so content stays focused.

**Module 0 — GitHub foundations.** Repositories, commits, and branches on GitHub; pull requests and code review; forks and contributing; protecting `main` with rulesets and required status checks. Outcome: the learner collaborates through pull requests on a protected branch, ready for CI to gate merges.

**Module 1 — What CI/CD and GitHub Actions are.** Why teams automate builds, tests, and deploys; continuous integration vs. delivery vs. deployment; where GitHub Actions fits next to Jenkins, GitLab CI, CircleCI, and Azure Pipelines; what it costs in public vs. private repos. Outcome: the learner can explain what a pipeline is for and why it matters to a team.

**Module 2 — Anatomy of a workflow.** Workflows, events, jobs, steps, runners, actions, the Marketplace, where files live (`.github/workflows/`), and a YAML crash course with the classic traps. Outcome: the learner writes and runs a first workflow from scratch.

**Module 3 — Triggers and filters.** Push, pull request, branch/tag/path filters, manual dispatch with inputs, schedules (cron plus timezone), releases, `repository_dispatch`, `workflow_call`, and when `pull_request` vs. `pull_request_target` runs. Outcome: the learner controls exactly when a workflow runs.

**Module 4 — Expressions, variables, secrets, and outputs.** Contexts, `if` conditions, status functions, `env` vs. `vars` vs. `secrets`, step and job outputs, passing data between jobs, artifacts, and a first look at matrix builds (covered in depth in Module 12). Outcome: the learner builds multi-job workflows that share data correctly.

**Module 5 — Runners.** GitHub-hosted images and labels, Linux/Windows/macOS, ARM runners, larger runners, why `-latest` can break a build, self-hosted runners and autoscaling (Actions Runner Controller), and cost trade-offs. Outcome: the learner picks the right runner for a job and explains why.

**Module 6 — Setups by project type.** A stack switcher showing a production-quality workflow for each, with annotations: Node/TypeScript, Python, Java (Maven and Gradle), Go, .NET, static sites, Docker images, mobile (Android on Linux runners, iOS on macOS runners and why that costs more), publishing packages to npm and PyPI with trusted publishing (OIDC, no stored tokens), Terraform (plan on PR, apply on merge), and monorepos. Outcome: the learner can set up CI for an unfamiliar stack by following the same pattern.

**Module 7 — Frontend pipelines.** React/Next.js, Vue, and Angular: install with caching, lint, typecheck, unit tests, build, bundle-size budgets, Lighthouse checks, visual or accessibility checks, and preview deployments per pull request. Outcome: the learner builds a complete frontend CI pipeline.

**Module 8 — Backend pipelines.** Node/Express, Python (FastAPI and Django), Java Spring Boot, Go, and .NET: unit tests, integration tests against Postgres and Redis service containers, database migrations in CI, Docker image build and push to GitHub Container Registry, and coverage reports. Outcome: the learner builds a complete backend CI pipeline with real dependencies.

**Module 9 — Keeping frontend and backend aligned.** This is a flagship module. The frontend and backend live in separate repos, written in different languages, and ship on different schedules. Teach three layers, from lightest to heaviest:

1. *Schema as the source of truth.* The backend publishes an OpenAPI spec. A backend PR check diffs the spec against `main` and fails on breaking changes (using a tool such as oasdiff). The frontend generates a typed client from the spec, so a mismatch becomes a compile error.
2. *Consumer-driven contract testing with Pact.* The frontend's tests record what it expects from the API as a contract. The backend's CI verifies it still honors every consumer's contract. A "can I deploy?" check gates releases on both sides.
3. *End-to-end tests.* Both apps start together in CI with Docker Compose, and Playwright runs real user journeys against them.

Also cover cross-repo coordination: a backend change triggers frontend checks through `repository_dispatch` or `workflow_dispatch`. Explain clearly that the default `GITHUB_TOKEN` cannot trigger workflows in another repository, and show the proper approach with a GitHub App token (for example via `actions/create-github-app-token`) or a fine-grained personal access token. Briefly note how the same ideas apply to GraphQL (schema checks). Outcome: the learner can explain and implement all three layers and knows which catches what.

**Module 10 — Security and supply chain.** Least-privilege `permissions` for `GITHUB_TOKEN` (including newer fine-grained permissions); secrets handling and masking; OIDC to AWS, GCP, and Azure instead of long-lived keys; pinning actions to SHAs and keeping pins updated with Dependabot; script injection through untrusted input like PR titles and branch names, and the fix (pass through `env`, never interpolate into `run`); `pull_request_target` dangers; cache poisoning; forks and secrets; workflow linting and scanning with actionlint, zizmor, and CodeQL for Actions; artifact attestations and build provenance; Dependabot and code scanning. Ground lessons in real incidents such as the 2025 compromise of the `tj-actions/changed-files` action and the 2024 Ultralytics release-pipeline compromise, verifying details before writing. Outcome: the learner can audit a workflow and fix its security problems.

**Module 11 — Deployment, environments, and releases.** Environments with required reviewers, wait timers, branch restrictions, and scoped secrets; environments without automatic deployments (`deployment: false`); dev → staging → production promotion; preview environments per PR with teardown; deploying to a cloud target and to container platforms; deployment strategies (rolling, blue-green, canary) at a conceptual level; semantic versioning, conventional commits, automated changelogs and releases; rollback workflows. Outcome: the learner designs a safe, staged delivery pipeline.

**Module 12 — Reusability and scaling.** Reusable workflows (`workflow_call`, inputs, secrets, outputs) and a shared-workflows repo; composite actions; writing a custom JavaScript action (Node 24) and a Docker action; matrix strategies; dependency and Docker layer caching; concurrency groups; path filters and change detection for monorepos; job and step timeouts; organization-level rulesets and required workflows; measuring and cutting CI time and cost. Outcome: the learner can take a slow, copy-pasted setup and make it fast and DRY.

**Module 13 — Debugging and operations.** Reading logs, enabling debug logging, re-running failed jobs, running workflows locally with `act` and its limits, SSH-style debugging patterns, handling flaky tests (retries, quarantine, tracking), job summaries, failure notifications to Slack or email, branch protection and rulesets with required status checks, merge queues, run and artifact retention (note: from October 1, 2026, checks and workflow runs follow the Actions retention setting, default 90 days). Outcome: the learner diagnoses failures methodically instead of guessing.

**Module 14 — Capstone.** See section 10.

**Reference pages:** a searchable YAML cheat sheet, a glossary, and an interview prep section with 40–60 real interview questions grouped by level, each with a model answer and a "follow-up they might ask".

## 8. Incident scenarios

Scenarios are the most engaging part of the app. Each one has: a short story (who you are, what just happened), starting files, the event that triggers it, rules that decide step outcomes based on the learner's YAML, 2–4 success checks, up to three progressive hints, and a debrief explaining the real-world lesson. Scenarios unlock alongside their module.

| # | Scenario | Module | What the learner fixes |
|---|----------|--------|------------------------|
| 1 | "Works on my machine" — tests pass locally, fail in CI on a different Node version | 4 | Add a version matrix and pin the runtime |
| 2 | The 14-minute pipeline — the team is waiting on every PR | 12 | Caching, parallel jobs, path filters; target under 5 minutes |
| 3 | The renamed field — a backend PR renames `userName` to `username` and would break the frontend | 9 | Add a spec diff and contract verification so the PR fails before merge |
| 4 | Frontend and backend deploy out of order | 9, 11 | Gate the deploy on a "can I deploy?" check |
| 5 | The secret in the logs — a token was echoed and hardcoded | 4, 10 | Move to secrets, understand masking, write a rotation checklist |
| 6 | The malicious PR title — a workflow interpolates the title into a shell command | 10 | Pass untrusted input through `env` |
| 7 | The dangerous trigger — `pull_request_target` checks out and runs fork code with secrets | 10 | Split into a safe two-workflow pattern |
| 8 | The moved tag — a third-party action's tag now points to malicious code | 10 | Pin to SHAs, add Dependabot for actions, restrict allowed actions |
| 9 | Straight to production — anyone can deploy on merge | 11 | Environments with required reviewers and branch restrictions |
| 10 | The bad release — v2.3.0 is broken in production | 11 | Run a rollback workflow and add a smoke test that would have caught it |
| 11 | Racing deploys — two merges deploy at once and the older one wins | 11, 12 | Concurrency groups |
| 12 | The flaky test — CI fails one run in five | 13 | Diagnose, add a targeted retry, quarantine, and report |
| 13 | The image migration — a `-latest` runner label moved and the build broke overnight | 5 | Pin the runner image and plan upgrades |
| 14 | The expired runtime — a custom JavaScript action still declares `node20` | 12 | Update to `node24` and understand runtime deprecations |
| 15 | The monorepo tax — a CSS change runs the full backend test suite | 12 | Path filters and change detection |
| 16 | The 3 a.m. job — a scheduled report runs at the wrong local time | 3 | Cron syntax and the schedule `timezone` option |
| 17 | The long-lived cloud key — AWS keys stored as repo secrets | 10 | Replace with OIDC and a scoped trust policy |

## 9. Companion repos (created in Phase 4)

Create these as real repositories the learner can fork. Keep them small but realistic, and make every workflow in them production-grade (pinned actions, least privilege, concurrency, caching).

- **`pipeline-lab-api`** — Python + FastAPI backend with Postgres. CI: lint, typecheck, unit and integration tests with a Postgres service container, OpenAPI export and breaking-change diff, Pact provider verification, Docker image to GitHub Container Registry, and a dispatch to the frontend repo when the API contract changes.
- **`pipeline-lab-web`** — React + TypeScript (Vite) frontend. CI: lint, typecheck, unit tests, a typed client generated from the API's OpenAPI spec, Pact consumer tests that publish contracts, build, preview deploy per PR, and a workflow that responds to the backend's dispatch.
- **`pipeline-lab-e2e`** (or a folder in one of the above; decide during Phase 4 planning) — Docker Compose that starts both apps plus Postgres, and Playwright journeys run in CI.
- **`pipeline-lab-workflows`** — shared reusable workflows and a composite action used by both app repos.

Decide in Phase 4 planning how contracts are shared: a Pact Broker (self-hosted in Docker or a hosted broker) or, for a zero-infrastructure start, contract files passed between repos. Document the setup steps a learner needs (fork, create a GitHub App or token, add secrets) in each repo's README, and link each "Try it for real" callout in the app to the right repo and file.

## 10. Capstone

The learner starts from a bare two-repo app (frontend and backend, no workflows) and must build the full delivery system: CI for both repos, schema and contract checks, end-to-end tests, preview environments, staged deployment with approval, release automation, a rollback path, and security hardening. Provide a requirements list, a self-assessment rubric, a pipeline review checklist the learner can reuse at work, and a reference solution hidden behind a "show solution" step. In the app, a capstone page tracks which requirements the learner has checked off.

## 11. Phases and acceptance criteria

Each phase starts with a plan for approval and ends with passing tests, a successful deploy, updated phase status in `CLAUDE.md`, and a `CHANGELOG.md` entry.

**Phase 1 — Foundation.** Monorepo scaffold, design plan (approved before UI work), app shell, routing, progress store with reset, the simulator engine covering parsing, validation, triggers, expressions, `needs` graph, matrix, outputs, and logs; the run view with editor, graph, logs, and playback; the Playground; modules 0–4 with quizzes; scenarios 1 and 16; this app's own CI (lint, typecheck, unit, e2e, image build) and Docker deployment to the droplet with a rollback path. Done when a learner can complete modules 0–4, finish both scenarios, and the site deploys from `main` via its own workflow.

**Phase 2 — Accounts and sync.** `apps/api` with Hono, Better Auth (email and password with verification and reset, and Google), Drizzle, and Postgres in the same compose project; synced progress, saved playground projects, and settings; guest progress merged on first sign-in; account export and deletion; a privacy page; nightly Postgres backups to Cloudflare R2 with a tested restore; `docs/deploy-aws.md`. Done when a learner can sign in with either method on two devices and see the same progress, and a backup has been restored successfully.

**Phase 3 — Runners and stacks.** Engine support for services, caching, runner labels, and more built-in action log libraries; modules 5–8 with the stack switcher; scenario 13. Done when every stack in modules 6–8 has an annotated workflow that runs in the simulator.

**Phase 4 — Alignment.** Module 9, scenarios 3 and 4, and the companion repos with working real pipelines, including the cross-repo trigger. Done when a breaking API change in the real backend repo fails CI before merge, and the frontend repo's checks run automatically in response.

**Phase 5 — Security and delivery.** Engine support for permissions, secret masking, fork behavior, environments, and approvals; modules 10–11; scenarios 5–11 and 17. Done when every security scenario can only be passed by the correct fix, not by deleting the risky step.

**Phase 6 — Scale and operations.** Engine support for concurrency, reusable workflows, and composite actions; modules 12–13; scenarios 2, 12, 14, and 15. Done when scenario 2 shows a measurable before/after run-time comparison.

**Phase 7 — Capstone and polish.** Module 14 capstone, cheat sheet, glossary, interview prep, a content accuracy pass re-verifying every lesson against current docs, an accessibility pass, and performance tuning (lazy-load Monaco and heavy modules). Done when all lessons show a recent `lastVerified` date and Lighthouse accessibility scores 95+.

## 12. Out of scope

Executing real code in the browser, and features of other CI systems (including a Jenkins track) beyond brief comparisons in Module 1. Put any other ideas in `docs/IDEAS.md`.
