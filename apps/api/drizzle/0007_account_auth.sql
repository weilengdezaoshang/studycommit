ALTER TYPE "public"."auth_provider" ADD VALUE IF NOT EXISTS 'account';--> statement-breakpoint
ALTER TABLE "auth_identities" ADD COLUMN IF NOT EXISTS "password_hash" text;