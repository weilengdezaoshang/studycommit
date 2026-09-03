CREATE TYPE "public"."agent_run_kind" AS ENUM('companion_followup');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" "agent_run_kind" NOT NULL,
  "status" "agent_run_status" DEFAULT 'pending' NOT NULL,
  "model" text,
  "prompt_version" text NOT NULL,
  "input" jsonb NOT NULL,
  "output" jsonb,
  "error" text,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_user_kind_created_idx" ON "agent_runs" USING btree ("user_id","kind","created_at");
