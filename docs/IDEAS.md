# Ideas parking lot

Ideas that come up during a phase but are outside its scope go here. Review them at the start of each phase plan.

## From Phase 1 planning (2026-09-11)

- **Jenkins track.** A separate Jenkins tutorial and simulator (Jenkinsfile, stages, agents), after the Actions curriculum is complete.
- **Staging on the droplet.** A second compose project as a staging environment, dogfooding Module 11.
- **PR preview deploys** for this repo.
- **Stale content check.** A monthly scheduled workflow that opens an issue for lessons whose `lastVerified` is older than 90 days.
- **`concurrency.queue`.** Simulate `queue: single | max` alongside `cancel-in-progress` (documented on docs.github.com as of 2026-09-11; Phase 6 engine work).
- **Syntax colouring** in lesson code blocks.
- **Automated axe checks** in Playwright, with the Phase 7 accessibility pass.
- **Uptime monitoring and error tracking** for the live site.

## From Phase 1 (2026-09-15)

- **Split the bundle.** Everything ships in one chunk of about 3.4 MB (880 kB gzipped), because Monaco and the workflow parser sit in the initial load. Lazy-loading the playground and scenario routes would cut what a reader of a lesson downloads. Phase 7 owns this.
- **Open in playground.** Lesson code blocks have a Copy button and the prose says "try it in the playground". Carrying the snippet across as a button would save the paste.
- **Revisit the Monaco worker alias.** `monaco-worker-manager`, pulled in by `monaco-yaml`, imports `monaco-editor/esm/vs/editor/editor.worker.js`, which monaco 0.56's exports map no longer resolves. `apps/web/vite.config.ts` aliases it; drop that once the upstream package catches up.
- **Deploy to the droplet.** The workflow is written and skips until `SITE_URL` exists. Picking up the runbook in `docs/DEPLOY.md` needs a domain and SSH access.
