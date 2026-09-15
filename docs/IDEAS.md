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

## From Phase 2 (2026-09-15)

- **Require the password to delete an account on the server too.** The web app asks for it, but Better Auth accepts deletion from a session under a day old without one. Tightening the session freshness rule, or a hook before deletion, would close that for direct API calls.
- **Stop sign-up revealing registered addresses.** Answer every sign-up with "check your inbox" and email the existing owner instead. The privacy page discloses the weakness until then.
- **Check new passwords against a list of common ones** before the site is public, which is when credential stuffing becomes a real threat.
- **Rate limits shared between API containers.** Better Auth keeps them in memory, which is right for one container and wrong for two.
- **An offline end-to-end test.** Skipped because finishing a lesson offline means scripting a quiz; the sync unit tests cover a failed request.
- **Keep the compose images current.** Dependabot watches the two Dockerfiles, not the Postgres, Mailpit and MinIO images pinned in `infra/compose.yml`, so those need bumping by hand.
- **Replace MinIO for local backup testing.** The newest image the project still publishes dates from September 2025.
- **Test deletion for a Google-only account** once Google credentials exist; that path relies on a recent sign-in instead of a password.
- **Tidy the Playground project row.** At desktop width, Delete wraps onto its own line under the other controls.
- **One Cache-Control header on API responses.** The web container's Nginx adds its site-wide `no-cache` alongside the API's own `no-store`. Browsers honour the stricter one, so it is harmless.
