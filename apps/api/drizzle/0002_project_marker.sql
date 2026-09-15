-- Fail fast rather than make traffic queue behind a lock on a busy server.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "deleted_at" timestamp with time zone;