# Deploying Pipeline Lab

This explains how the site runs in production, what each piece does, and why it is there. The droplet also hosts other services, so everything here is scoped to Pipeline Lab and leaves the rest alone.

## The request path

```
browser ─HTTPS─> host Nginx :443            (already on the droplet, serves other sites too)
                   └─ server_name <domain> ─> 127.0.0.1:8080 ─> web container (nginx + built files)
```

Phase 2 adds `/api/` to a second container and a Postgres container on the same private network.

## The pieces

**Docker image.** A container image is a filesystem plus the command to start it. Ours is built by `apps/web/Dockerfile` in two stages:

1. The build stage uses `node:24.21.0-alpine3.24` to run `npm ci` and `npm run build`.
2. The final stage uses `nginx:stable-alpine` and copies in only `dist/` and our Nginx config.

The second stage is why the image is small and has a small attack surface: no Node, no source code, no dependencies. Both base images are pinned by tag *and* digest (`@sha256:…`), so a rebuild uses exactly the same bytes even if the tag moves. This is the same reasoning behind pinning actions to a commit SHA.

**Compose project.** `infra/compose.yml` declares the container. Its `name: pipeline-lab` means every `docker compose` command here acts only on our containers, never the droplet's other stacks. It sets:

- `ports: "127.0.0.1:8080:80"` — published Docker ports bypass ufw, so binding to localhost keeps the container off the public internet. Only the host's Nginx can reach it.
- `mem_limit: 128m` — a spike here cannot starve the other services.
- `restart: unless-stopped` — the container comes back after a reboot.
- log rotation — Docker's default log file grows forever otherwise.

**Host Nginx.** `infra/nginx/pipeline-lab.conf` is a versioned copy of the site installed on the droplet. It terminates TLS and proxies the domain to port 8080. The existing sites are untouched: this is one more file in `sites-enabled`.

**Certbot.** Obtains and renews the TLS certificate for the domain.

**GitHub Container Registry.** CI builds the image and pushes it to `ghcr.io/thongam-bikash/pipeline-lab-web`. The droplet pulls it rather than building, which keeps the 2 GB box free for running things. The image holds no secrets, so it can be public and the server needs no registry login.

## Run it locally

```sh
docker compose -f infra/compose.yml up --build
```

Then open `http://127.0.0.1:8080`. Deep links such as `/modules/1` work because the container's Nginx falls back to `index.html`.

To stop it:

```sh
docker compose -f infra/compose.yml down
```

## Droplet runbook

Run the inspection first and read the output before changing anything.

### 1. Inspect (read-only)

```sh
ss -tlnp | grep -E ':(80|443|8080) '   # is 8080 free, and what owns 80/443
docker ps                              # what is already running
docker stats --no-stream               # how much memory is spare
free -h && df -h                       # headroom
nginx -T | grep server_name            # existing sites
certbot certificates                   # existing certificates
```

If port 8080 is taken, pick another free port and change it in `infra/compose.yml` and the site file together.

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

### 5. First run

```sh
IMAGE_TAG=<commit sha> docker compose -f compose.yml pull
IMAGE_TAG=<commit sha> docker compose -f compose.yml up -d
curl -fsS -o /dev/null -w '%{http_code}\n' https://<your domain>/
```

## Rules for this droplet

- Inspect before changing. Report what is there before touching it.
- `nginx -t` before every reload, and reload rather than restart.
- Scope every Docker command to this project (`docker compose -f infra/compose.yml …`). Never run `docker system prune -a`: it would delete other services' images.
- Keep only the last few Pipeline Lab images, so rollback stays possible without filling the disk.
