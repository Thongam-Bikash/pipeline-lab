# Pipeline Lab on AWS

Documentation only. Pipeline Lab runs on a DigitalOcean droplet, as described in [DEPLOY.md](DEPLOY.md). This page describes how the same system would run on AWS, so the two can be compared, and so the ideas carry over to a job where AWS is what the team uses.

Nothing here has been built or run. Service names and features are stable, well-established parts of AWS; prices are deliberately left out, because they change. Check the AWS pricing pages before deciding anything on cost.

## The same system, piece by piece

| On the droplet | On AWS | What changes |
|---|---|---|
| The droplet | **ECS on Fargate** | No server to patch. You describe containers, and AWS runs them. |
| `infra/compose.yml` | An **ECS task definition** per service, and an **ECS service** to keep each running | The same images, ports, environment and memory limits, written as JSON or infrastructure-as-code instead of YAML. |
| Host Nginx and Certbot | An **Application Load Balancer** with a certificate from **ACM** | TLS terminates at the load balancer, and ACM renews certificates on its own. |
| The web container's `/api/` proxy | Either kept as it is, or replaced by an ALB rule sending `/api/*` to the API service | Keeping it means no application change at all. |
| GitHub Container Registry | **ECR** | Images live in the same account as the services that run them. |
| The `db` container and its volume | **RDS for PostgreSQL** | Backups, patching, and failover become settings rather than work. Check that RDS offers the Postgres major version the compose file pins before choosing. |
| `infra/.env` on the server | **Secrets Manager** or **SSM Parameter Store** | The task definition names each secret, and ECS injects it into the container at start. |
| Mailpit, or an SMTP provider | **SES** | `SMTP_URL` points at SES's SMTP endpoint with SES SMTP credentials. The sending domain needs verifying, with DKIM. |
| Cloudflare R2 | **S3** | The backup code already speaks the S3 API. Only the `S3_*` settings change. |
| The backup cron line | An **EventBridge Scheduler** schedule that runs the backup as a one-off ECS task | |
| SSH with a deploy key | **OIDC from GitHub Actions** to an IAM role | No long-lived AWS keys stored anywhere. See below. |

## Networking

On the droplet, "not reachable from the internet" means binding a port to `127.0.0.1`. On AWS it means network placement and security groups:

- A VPC with public subnets for the load balancer, and private subnets for the tasks and the database.
- The load balancer's security group accepts 80 and 443 from anywhere.
- The web and API tasks accept traffic only from the load balancer's security group.
- The database's security group accepts 5432 only from the API's security group.

"Not published" on the droplet becomes "no rule allowing it" on AWS. The idea is the same: nothing reaches the database except the API.

Tasks in private subnets need a way to pull images and write logs. That is either a NAT gateway or VPC endpoints for ECR, S3 and CloudWatch Logs. A NAT gateway is a notable, easily overlooked cost for a small project, which is worth knowing before drawing the diagram.

## Deploying without stored keys

On the droplet, the deploy job holds an SSH key as a repository secret. On AWS the better pattern stores no credential at all:

1. In IAM, add GitHub's OIDC provider (`token.actions.githubusercontent.com`) to the AWS account.
2. Create a role whose trust policy allows only this repository's `production` environment to assume it: the token's audience must be `sts.amazonaws.com`, and its subject must be `repo:Thongam-Bikash/pipeline-lab:environment:production`.
3. Give that role only what a deploy needs: pushing to the two ECR repositories, registering task definitions, running tasks, and updating the two services.
4. The deploy job asks for `id-token: write` permission, and exchanges GitHub's short-lived token for temporary AWS credentials. The official `aws-actions/configure-aws-credentials` action does the exchange; pin it to a commit SHA, like every other action in this repository.

A pull request, a fork, or another branch cannot deploy, because the role's trust policy will not accept their tokens. And there is no key to leak or rotate.

In `ci.yml`, the `check` and `e2e` jobs stay exactly as they are. `image` pushes to ECR instead of the GitHub registry. `deploy` replaces its SSH steps with the OIDC login, the migration task below, and a service update.

## Migrations

On the droplet, `migrate` runs before the API because of `service_completed_successfully`. ECS services have no such ordering, so the deploy does it explicitly:

1. Register the new task definitions.
2. Run the API image once, as a standalone task with its command overridden to `node dist/migrate.js`.
3. Wait for that task to stop, and read its exit code. If it is not 0, stop the deploy: the old API keeps running against the old schema, which is exactly what the compose file's ordering guarantees today.
4. Only then update the services, and let ECS replace the old tasks.

Migrations here only ever add things, so old and new API tasks can run side by side against the new schema while ECS swaps them over.

## Backups

RDS takes automated backups and supports point-in-time recovery, so the nightly `pg_dump` is no longer the only copy. It is still worth keeping, for two reasons: a dump is portable to any Postgres, and it is exactly what the account export and the restore drill already understand.

Either way, **the restore drill is still required**. With RDS, the drill is restoring a snapshot to a new, temporary instance and checking the tables. With the dump, it is the existing `restore-drill.ts`, pointed at S3. An untested backup is equally untrustworthy on either platform.

Retention works the same: an S3 lifecycle rule expiring backups after 29 days, and a matching retention period on RDS's automated backups.

## What costs money

Without figures, since they change, the things that are billed:

- The Fargate tasks, by the vCPU and memory each one reserves, for every hour they run.
- The Application Load Balancer, per hour and by traffic.
- The RDS instance, per hour, plus its storage and backup storage.
- A NAT gateway, if used, per hour and per gigabyte through it.
- Secrets Manager, per secret per month. Parameter Store's standard tier costs less.
- S3 storage for backups, and SES per message sent.
- Data leaving AWS to the internet.

On the droplet, the equivalent is one fixed monthly price for the whole box, already paid for by the other services on it.

## The verdict

For this project, the shared droplet is the right call. Pipeline Lab is small, its traffic is modest, and it fits in 640 MB alongside services that already pay for the machine. AWS would replace a few hours of setup and occasional patching with several billed services, each doing a job the droplet already does well enough.

AWS becomes the better choice when one of these becomes true: the site needs to survive the loss of a whole server; traffic needs more than one API container; a team needs audited, role-based access to production; or the organisation already runs on AWS. The design already anticipates that move: one-shot migrations, configuration from the environment, stateless containers, S3-compatible backups, and a same-origin API.

## Not covered

Multiple regions, autoscaling policies, blue-green or canary deployments, and infrastructure as code. Deployment strategies are taught in Module 11.
