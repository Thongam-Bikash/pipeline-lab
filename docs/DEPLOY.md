# Deploying Pipeline Lab

This explains how the site runs in production, what each piece does, and why it is there. The droplet also hosts other services, so everything here is scoped to Pipeline Lab and leaves the rest alone.

Nothing has been deployed yet. There is no server or domain, so the deploy job skips itself, and everything below has been run locally but not on a droplet.

## The request path

```
browser ─HTTPS─> host Nginx :443                  (already on the droplet, serves other sites too)
                   └─ server_name <domain> ─> 127.0.0.1:8080 ─> web container (Nginx + built files)
                                                                  └─ /api/ ─> api container :3000 ─> db container :5432
```

The browser only ever talks to one origin. The web container's Nginx serves the app and passes `/api/` to the API over the compose project's private network. That is why there is no CORS configuration, no API URL baked into the build, and no third-party cookie: the session cookie belongs to the same origin as the page.

It also means the host's Nginx site needed no change for Phase 2. It still proxies everything to port 8080.

## The pieces

**Web image.** Built by `apps/web/Dockerfile` in two stages: `node:24.21.0-alpine3.24` runs `npm ci` and builds the app, and the final stage is `nginx:stable-alpine` with only the built files and our Nginx config. No Node, no source code, no dependencies ship in it. Both base images are pinned by tag *and* digest (`@sha256:…`), so a rebuild uses exactly the same bytes even if the tag moves, for the same reason actions are pinned to a commit SHA.

The web container's Nginx resolves the API through Docker's own DNS on every request (`resolver 127.0.0.11` and a variable in `proxy_pass`). A literal `proxy_pass http://api:3000` would look the address up once at startup, and every redeploy gives the API container a new address, so the site would serve 502s until someone restarted it.

**API image.** Built by `apps/api/Dockerfile`. Unlike the web image it has to contain Node, because it runs the server. The build stage installs everything and compiles TypeScript; the final stage reinstalls only the API's production dependencies. `npm prune` would not do: in a workspace it keeps every workspace's dependencies, which would ship React and Monaco inside the API image. It runs as the unprivileged `node` user, and it carries the Postgres 18 client (`pg_dump`, `psql`) for backups. That one package comes from Alpine's repository and cannot be pinned by digest.

**Compose project.** `infra/compose.yml`, with `name: pipeline-lab`, so every `docker compose` command here acts only on our containers.

| Service | Runs | Why |
|---|---|---|
| `web` | always | the app and the `/api/` proxy, on `127.0.0.1:8080` |
| `api` | always | Hono and Better Auth, on `127.0.0.1:8082` |
| `migrate` | once, before `api` | applies database migrations, then exits |
| `db` | always | Postgres 18, on `127.0.0.1:5433` |
| `backup` | on demand only | `pg_dump` to S3-compatible storage, and the restore drill |
| `mailpit` | `dev` profile only | catches outgoing email locally |
| `minio` | `dev` profile only | S3-compatible storage for testing backups locally |

Things worth knowing about it:

- Every published port is bound to `127.0.0.1`. Published Docker ports bypass ufw, so binding to localhost is what keeps the containers off the public internet. The API and database ports are published only so development tools can reach them.
- The API waits for `migrate` with `condition: service_completed_successfully`. A failed migration leaves the API unstarted, with the reason in the migrate container's log, rather than running new code against an old schema.
- The database volume mounts at `/var/lib/postgresql`, not `/var/lib/postgresql/data`. Postgres 18 moved its data under a version directory and moved the declared volume up a level; mounting the old path writes the database into the container layer, where it disappears on the next image change.
- Memory limits. On a server the always-on services use web 128 MB, API 256 MB and database 256 MB: 640 MB of the 2 GB droplet. `migrate` (128 MB) and `backup` (256 MB) only exist while they run.
- `mailpit` and `minio` sit behind the `dev` profile and `backup` behind its own, so a plain `docker compose up -d` on a server never starts them.
- `backup` is the only container given the storage credentials, so the long-running API never holds them.
- Log rotation on every service, because Docker's default log file grows forever.

**Host Nginx.** `infra/nginx/pipeline-lab.conf` is a versioned copy of the site installed on the droplet. It terminates TLS and proxies the domain to port 8080. The existing sites are untouched: this is one more file in `sites-enabled`.

**Certbot.** Obtains and renews the TLS certificate for the domain.

**GitHub Container Registry.** CI builds both images and pushes them to `ghcr.io/thongam-bikash/pipeline-lab-web` and `ghcr.io/thongam-bikash/pipeline-lab-api`. The droplet pulls them rather than building, which keeps the 2 GB box free for running things. Neither image holds a secret: configuration arrives at runtime from the server's `.env` file.

Both packages can be pulled without logging in (checked on 15 September 2026 with an anonymous request for each image's manifest), so the server needs no registry login. A package added later may start out private: check its visibility in the package settings before relying on that.

## Run it locally

```sh
cp infra/.env.example infra/.env        # then fill in POSTGRES_PASSWORD and BETTER_AUTH_SECRET
docker compose -f infra/compose.yml --profile dev up --build
```

| Address | What |
|---|---|
| `http://localhost:8080` | the app, with the API under `/api/` |
| `http://localhost:8082` | the API directly, for the Vite dev and preview servers |
| `localhost:5433` | Postgres, for `psql` and the API's route tests |
| `http://localhost:8083` | Mailpit: every email the app sends lands here |
| `http://localhost:8084`, `:8085` | MinIO's S3 endpoint and its console |

Postgres is on 5433 because a host Postgres often already owns 5432.

For the web dev server with hot reload, keep the stack running and start `npm run dev` from the repository root. It proxies `/api` to port 8082, so the app behaves the same as in the container.

To stop everything:

```sh
docker compose -f infra/compose.yml --profile dev down
```

Add `-v` only if you mean to delete the local database and MinIO data as well.

## Configuration and secrets

Configuration lives in `infra/.env`, which Compose reads automatically. The file is git-ignored; `infra/.env.example` is committed and lists every variable.

| Variable | Needed | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | The database password. Letters and digits only, because it is placed inside a connection URL, where `@`, `/`, `:` or `#` would break it. `openssl rand -hex 32` makes one. |
| `BETTER_AUTH_SECRET` | yes | Signs sessions. `openssl rand -hex 32`. Changing it signs everyone out. |
| `PUBLIC_URL` | on a server | The address people use, such as `https://<your domain>`. Links in emails and the Google callback are built from it, and cookies are marked `Secure` when it is `https`. |
| `TRUSTED_ORIGINS` | locally | Extra origins allowed to call the auth API. Defaults to the Vite dev and preview servers. Set it empty on a server. |
| `SMTP_URL`, `MAIL_FROM` | on a server | A real mail provider and a sender address on a domain with SPF and DKIM records, or verification mail lands in spam. Locally they default to Mailpit. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | Google sign-in. Leave both empty and the button stays hidden. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | on a server | Backup storage. Locally they default to MinIO. For Cloudflare R2 the endpoint is `https://<account id>.r2.cloudflarestorage.com` and the region is `auto`. |
| `RATE_LIMIT` | never on a server | `off` exists only for the end-to-end tests, which sign up far more often than any person would. |

A required variable is written `${POSTGRES_PASSWORD:?…}` in `compose.yml`. If it is missing, `docker compose up` stops with the variable's name instead of starting a container that fails later in a confusing way.

**How secrets reach the server.** They don't travel with a deploy. `~/pipeline-lab/.env` is created once by hand on the droplet, readable only by the deploy user. The deploy job copies `compose.yml` and nothing else, and checks that `.env` exists before doing anything, so a deploy cannot overwrite or leak it, and no secret ever passes through a GitHub runner. Adding a variable means editing that file *before* merging the change that needs it.

**Google sign-in.** In Google Cloud, create an OAuth client of type "Web application" with the redirect URI `<PUBLIC_URL>/api/auth/callback/google`, and `http://localhost:8080/api/auth/callback/google` for local use. The consent screen asks for a privacy policy URL: `<PUBLIC_URL>/privacy`. Put the ID and secret in `.env` and restart the API; the button appears without rebuilding the web app.

## The database

Migrations are SQL files in `apps/api/drizzle/`, generated from `apps/api/src/schema.ts` and committed like any other code, so every schema change is reviewed as SQL.

```sh
npm run db:generate -w @pipeline-lab/api      # after changing schema.ts; needs no database
```

They are applied by the `migrate` container on every `docker compose up`. Applied migrations are recorded in `drizzle.__drizzle_migrations`, so running it again changes nothing. Each migration sets a short lock timeout, so on a busy table it fails quickly instead of making every request queue behind it.

So far every change has only added things: new tables, and nullable columns without defaults. Postgres applies those as catalogue changes, without rewriting a table. Rolling back code after such a migration is safe; the schema stays. A change that drops or renames something needs to be split into steps, and the `db-schema-change` skill in `.claude/skills/` walks through how.

To look inside:

```sh
docker compose -f infra/compose.yml exec db psql -U pipeline_lab pipeline_lab
```

The database volume is the only thing on the droplet that cannot be rebuilt from the repository. Treat it accordingly.

## Backups and restore

A backup is `pg_dump`, compressed and uploaded to S3-compatible storage: MinIO locally, Cloudflare R2 on a server. The same code talks to both; only the `S3_*` settings change.

```sh
docker compose -f infra/compose.yml --profile dev run --rm backup                                # take a backup
docker compose -f infra/compose.yml --profile dev run --rm backup node dist/restore-drill.js     # prove it restores
```

**The restore drill is the part that matters.** It downloads the newest backup, restores it into a scratch database, checks that every table came back, prints each table's row count beside the live one, and drops the scratch database whatever happens. A backup that has never been restored is a hope, not a backup. Run the drill after setting backups up, and then every quarter.

**Retention** is a rule on the bucket, not code that deletes objects: backups expire after 29 days. Not 30, because storage services can run expiry up to a day late, and the privacy page promises copies are gone within 30 days of an account being deleted. Locally the rule is created with the MinIO bucket. On R2, create the bucket and add an object lifecycle rule deleting objects after 29 days once, in the Cloudflare dashboard, and create an API token limited to that bucket.

**Schedule on the droplet**: one line in `/etc/cron.d/pipeline-lab-backup`, running as the deploy user at 03:17 each night. It uses whichever API image is currently deployed:

```
17 3 * * * deploy cd /home/deploy/pipeline-lab && IMAGE_TAG=$(docker inspect --format '{{.Config.Image}}' pipeline-lab-api-1 | cut -d: -f2) docker compose --profile backup run --rm backup >> backup.log 2>&1
```

Not a GitHub Actions schedule, which would mean exposing the database to the internet, and not a timer inside the API process, which would stop silently whenever the API restarts.

The MinIO image used locally is `quay.io/minio/minio`, pinned to a release from September 2025, the newest the project still publishes. It is only for local testing and never runs on a server.

## Droplet runbook

Run the inspection first and read the output before changing anything.

### 1. Inspect (read-only)

```sh
ss -tlnp | grep -E ':(80|443|8080|8082|5433) '   # are our ports free, and what owns 80/443
docker ps                                        # what is already running
docker stats --no-stream                         # how much memory is spare: we need about 640 MB
free -h && df -h                                 # headroom
nginx -T | grep server_name                      # existing sites
certbot certificates                             # existing certificates
```

If a port is taken, pick another free one and change it in `infra/compose.yml`, and for 8080 in the site file too.

### 2. Deploy user

```sh
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
```

Add the deploy key's public half to `/home/deploy/.ssh/authorized_keys`. The key is made for this workflow only and is not reused anywhere else.

Note: membership of the `docker` group is equivalent to root on the host, because the Docker daemon runs as root. That is the trade-off for letting the workflow deploy without a password. The account is otherwise unprivileged and accepts only key-based SSH.

### 3. The site

```sh
sudo cp /etc/nginx/sites-available/pipeline-lab /root/pipeline-lab.conf.bak 2>/dev/null || true
sudo cp infra/nginx/pipeline-lab.conf /etc/nginx/sites-available/pipeline-lab
sudo sed -i "s/PIPELINE_LAB_DOMAIN/<your domain>/" /etc/nginx/sites-available/pipeline-lab
sudo ln -sf /etc/nginx/sites-available/pipeline-lab /etc/nginx/sites-enabled/pipeline-lab
sudo nginx -t                 # never skip this
sudo systemctl reload nginx   # reload, not restart, so other sites keep their connections
```

### 4. DNS and TLS

Point an A record for the domain at the droplet, wait for it to resolve, then:

```sh
sudo certbot --nginx -d <your domain>
```

Certbot edits the site file to add the certificate and the HTTP to HTTPS redirect, and installs a renewal timer.

### 5. Configuration

As the deploy user, create `~/pipeline-lab/.env` from `infra/.env.example` with real values: a generated database password and auth secret, `PUBLIC_URL=https://<your domain>`, an empty `TRUSTED_ORIGINS`, the mail provider, and the R2 credentials. Then:

```sh
chmod 600 ~/pipeline-lab/.env
```

### 6. First run

```sh
cd ~/pipeline-lab
IMAGE_TAG=<commit sha> docker compose pull
IMAGE_TAG=<commit sha> docker compose up -d
curl -fsS -o /dev/null -w '%{http_code}\n' https://<your domain>/
curl -fsS https://<your domain>/api/health
```

### 7. Backups

Install the cron line from [Backups and restore](#backups-and-restore), take one backup by hand, and run the restore drill against R2 before calling it done.

## The deploy workflow

`.github/workflows/ci.yml` does all of it:

| Job | When | What it does |
|---|---|---|
| `check` | every push and pull request | lint, typecheck, then the unit tests with the coverage gate, against a Postgres service container with the migrations applied, so the API's route tests run for real |
| `e2e` | every push and pull request | starts the API, database and Mailpit from `infra/compose.yml`, then runs Playwright against the production build, including sign-up, email links, sync across two browsers, export and account deletion |
| `image` | push to `main` | builds the web and API images from one matrix and pushes both, tagged with the commit SHA and `latest` |
| `deploy` | push to `main`, or a manual run | copies `compose.yml`, checks `.env` exists on the server, pulls the tag, restarts, checks the site and `/api/health` answer, and keeps the last few images of each |

The workflow asks for `contents: read` and nothing more; only `image` adds `packages: write`. Every secret and every matrix value reaches the shell through `env:` rather than string interpolation, which is the habit that prevents script injection.

The `e2e` job's database password and auth secret are generated for that run and thrown away with the runner. The `check` job's database password is written in the workflow on purpose: it protects a database that exists for two minutes on a machine nobody else can reach.

Pull request runs cancel when you push again. Runs on `main` do not, and `deploy` has its own concurrency group, so a deploy is never cancelled halfway.

Until the `SITE_URL` variable is set, `deploy` skips itself. Everything else still runs on every merge, and the images are still built and pushed, so the server can be set up whenever you are ready without the workflow failing in the meantime.

### Secrets and variables to create

On the repository's `production` environment:

| Name | Kind | Value |
|---|---|---|
| `DEPLOY_HOST` | secret | the droplet's hostname or IP |
| `DEPLOY_USER` | secret | `deploy` |
| `DEPLOY_SSH_KEY` | secret | the private half of the deploy key |
| `DEPLOY_KNOWN_HOSTS` | secret | output of `ssh-keyscan <host>` |
| `SITE_URL` | variable | `https://<your domain>/` |

Pinning `known_hosts` matters. Without it the deploy would accept any host key it is offered, which is how a deploy ends up talking to the wrong machine.

### Rolling back

Run the workflow by hand (Actions, then CI, then Run workflow) and put an earlier commit SHA in the `tag` field. The deploy job pulls that image instead of building a new one, so a rollback is a pull and a restart. The checks still run first, so a rollback cannot ship something that fails its own tests.

A rollback restores code, not data. Migrations are only ever additive, so older code runs against the newer schema. If data itself is damaged, restore a backup into a scratch database first, the way the drill does, and copy back what is needed.

## Rules for this droplet

- Inspect before changing. Report what is there before touching it.
- `nginx -t` before every reload, and reload rather than restart.
- Scope every Docker command to this project (`docker compose` from `~/pipeline-lab`, or with `-f`). Never run `docker system prune -a`: it would delete other services' images.
- Never publish the database or the API beyond `127.0.0.1`.
- Never set `RATE_LIMIT` on the server.
- Keep only the last few Pipeline Lab images, so rollback stays possible without filling the disk.
