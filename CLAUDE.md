# Pipeline Lab

An interactive web app that teaches GitHub and GitHub Actions from zero to industry-ready, using lessons, a browser-based workflow simulator, real-life incident scenarios, quizzes, and companion GitHub repos where learners run real pipelines.

The full specification lives in `docs/PROJECT_BRIEF.md`. Read it before starting or resuming any phase.

## Stack

- npm workspaces monorepo: `apps/web`, `apps/api` (Phase 2), `packages/engine`
- Vite + React + TypeScript (strict mode), React Router
- Tailwind CSS driven by custom tokens in `apps/web/src/styles/tokens.css` (the default palette is disabled)
- Monaco editor via `@monaco-editor/react` with `monaco-yaml` for workflow editing and schema hints
- GitHub's `@actions/workflow-parser` and `@actions/expressions` inside the simulator, plus `yaml` for source positions
- MDX for lesson content
- Zustand for learner progress, persisted to localStorage (synced to the API from Phase 2)
- Vitest for unit tests, Playwright for end-to-end tests
- Phase 2: Hono API, Better Auth (email and Google), Drizzle + Postgres, Cloudflare R2 for backups
- Runs in Docker on a DigitalOcean droplet behind the host's Nginx; images on GitHub Container Registry, deployed by this repo's own workflow

## Commands (from the repo root)

- `npm run dev` — web dev server
- `npm run lint` and `npm run typecheck`
- `npm test` — Vitest across workspaces (the engine must stay at 100% coverage)
- `npm run test:e2e` — Playwright
- `npm run build` — production build
- `docker compose -f infra/compose.yml up` — run the production image locally

## Working rules

1. Plan before coding. At the start of each phase, present a plan (files, components, engine changes, open questions) and wait for approval.
2. Accuracy over memory. Before writing any GitHub Actions syntax, action version, runner label, permission name, or price into lesson content, verify it against docs.github.com or the GitHub changelog. Never invent workflow keys. Every lesson stores a `lastVerified` date.
3. The simulator is honest. It models a documented subset of GitHub Actions. When a workflow uses something unsupported, show a clear "not simulated" notice instead of silently ignoring it.
4. The engine in `packages/engine/` is pure TypeScript with no React imports, and is fully unit tested.
5. Content lives in `apps/web/src/content/` (MDX lessons, scenario definitions, quiz JSON), separate from UI code.
6. This repo practices what it teaches: its own workflows pin third-party actions to full commit SHAs with a version comment, pin base images, set least-privilege `permissions`, and use concurrency groups.
7. Keep it simple. No abstraction until there is a second use. A component moves to `components/ui/` only when two or more features use it. No barrel files.
8. Comments are one short line and explain why, not what. No long comment blocks.
9. Commit after each meaningful step, so there is always a known good point to roll back to.
10. The droplet is shared. Inspect read-only before changing anything, run `nginx -t` before reloading Nginx, and scope every Docker command to the `pipeline-lab` compose project.
11. Stay inside the current phase. Put new ideas in `docs/IDEAS.md` instead of building them.
12. At the end of each phase: all tests pass, the site deploys, the phase status below is updated, and `CHANGELOG.md` gets an entry.

## Phase status

- [x] Phase 1 — Foundation, simulator core, modules 0–4, first scenarios, Docker packaging. The
      deploy job is written and skips until `SITE_URL` is set: there is no server or domain yet,
      so nothing has been deployed and the rollback drill is still untried.
- [ ] Phase 2 — Accounts and sync: API, Postgres, email and Google sign-in, R2 backups, AWS deploy doc
- [ ] Phase 3 — Runners, project types, frontend and backend pipelines (modules 5–8)
- [ ] Phase 4 — Frontend/backend alignment and companion repos (module 9)
- [ ] Phase 5 — Security, deployment, environments, releases (modules 10–11)
- [ ] Phase 6 — Reusability, scaling, debugging, operations (modules 12–13)
- [ ] Phase 7 — Capstone, interview prep, cheat sheet, glossary, polish (module 14)
