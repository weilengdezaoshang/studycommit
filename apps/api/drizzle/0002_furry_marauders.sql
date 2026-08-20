CREATE TABLE "learning_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"gains" text,
	"problems" text,
	"next_step" text,
	"effective_duration_seconds" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_logs_duration_nonnegative" CHECK ("learning_logs"."effective_duration_seconds" >= 0),
	CONSTRAINT "learning_logs_version_positive" CHECK ("learning_logs"."version" >= 1),
	CONSTRAINT "learning_logs_gains_length" CHECK ("learning_logs"."gains" IS NULL OR length("learning_logs"."gains") <= 10000),
	CONSTRAINT "learning_logs_problems_length" CHECK ("learning_logs"."problems" IS NULL OR length("learning_logs"."problems") <= 10000),
	CONSTRAINT "learning_logs_next_step_length" CHECK ("learning_logs"."next_step" IS NULL OR length("learning_logs"."next_step") <= 5000)
);
--> statement-breakpoint
ALTER TABLE "learning_logs" ADD CONSTRAINT "learning_logs_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_logs" ADD CONSTRAINT "learning_logs_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_logs_session_unique_idx" ON "learning_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "learning_logs_user_created_idx" ON "learning_logs" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "learning_logs_user_topic_created_idx" ON "learning_logs" USING btree ("user_id","topic_id","created_at","id");--> statement-breakpoint
INSERT INTO "learning_logs" (
  "user_id",
  "session_id",
  "topic_id",
  "effective_duration_seconds",
  "created_at",
  "updated_at"
)
SELECT
  "user_id",
  "id",
  "topic_id",
  "duration_seconds",
  "completed_at",
  "completed_at"
FROM "study_sessions"
WHERE "status" = 'completed'
  AND "duration_seconds" IS NOT NULL
  AND "completed_at" IS NOT NULL
ON CONFLICT ("session_id") DO NOTHING;--> statement-breakpoint
UPDATE "topics" AS topic
SET "total_duration_seconds" = COALESCE((
  SELECT SUM(log."effective_duration_seconds")::integer
  FROM "learning_logs" AS log
  WHERE log."topic_id" = topic."id"
), 0);