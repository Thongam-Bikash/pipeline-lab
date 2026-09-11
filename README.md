# Pipeline Lab

Learn GitHub and GitHub Actions from zero to industry-ready: lessons, a browser-based workflow simulator, incident scenarios, and quizzes.

## Getting started

Requires Node 24.

```sh
npm install
npm run dev
```

Other commands are listed in [CLAUDE.md](CLAUDE.md). The full specification is in [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md), and deployment is explained in `docs/DEPLOY.md`.

## Layout

- `apps/web` — the React app
- `packages/engine` — the workflow simulator (pure TypeScript)
- `infra` — Docker Compose and the Nginx site for the droplet
