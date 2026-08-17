CREATE TYPE "public"."study_session_status" AS ENUM('running', 'paused', 'completed');--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"goal" varchar(500),
	"status" "study_session_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"total_paused_seconds" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_seconds" integer,
	"completion_source" varchar(20),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_sessions_version_positive" CHECK ("study_sessions"."version" >= 1),
	CONSTRAINT "study_sessions_total_paused_nonnegative" CHECK ("study_sessions"."total_paused_seconds" >= 0),
	CONSTRAINT "study_sessions_duration_nonnegative" CHECK ("study_sessions"."duration_seconds" IS NULL OR "study_sessions"."duration_seconds" >= 0),
	CONSTRAINT "study_sessions_paused_after_start" CHECK ("study_sessions"."paused_at" IS NULL OR "study_sessions"."paused_at" >= "study_sessions"."started_at"),
	CONSTRAINT "study_sessions_completed_after_start" CHECK ("study_sessions"."completed_at" IS NULL OR "study_sessions"."completed_at" >= "study_sessions"."started_at"),
	CONSTRAINT "study_sessions_state_fields" CHECK (
    ("study_sessions"."status" = 'running' AND "study_sessions"."paused_at" IS NULL AND "study_sessions"."completed_at" IS NULL AND "study_sessions"."duration_seconds" IS NULL AND "study_sessions"."completion_source" IS NULL)
    OR ("study_sessions"."status" = 'paused' AND "study_sessions"."paused_at" IS NOT NULL AND "study_sessions"."completed_at" IS NULL AND "study_sessions"."duration_seconds" IS NULL AND "study_sessions"."completion_source" IS NULL)
    OR ("study_sessions"."status" = 'completed' AND "study_sessions"."paused_at" IS NULL AND "study_sessions"."completed_at" IS NOT NULL AND "study_sessions"."duration_seconds" IS NOT NULL AND "study_sessions"."completion_source" IN ('online', 'offline_sync'))
  )
);
--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "study_sessions_one_active_per_user_idx" ON "study_sessions" USING btree ("user_id") WHERE "study_sessions"."status" IN ('running', 'paused');--> statement-breakpoint
CREATE INDEX "study_sessions_user_started_idx" ON "study_sessions" USING btree ("user_id","started_at","id");--> statement-breakpoint
CREATE INDEX "study_sessions_topic_completed_idx" ON "study_sessions" USING btree ("user_id","topic_id","completed_at") WHERE "study_sessions"."status" = 'completed';