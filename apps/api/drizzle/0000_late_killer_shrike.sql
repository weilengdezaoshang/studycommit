CREATE TYPE "public"."topic_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"user_id" uuid NOT NULL,
	"key" varchar(200) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_records_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(1000),
	"color" varchar(7) NOT NULL,
	"status" "topic_status" DEFAULT 'active' NOT NULL,
	"total_duration_seconds" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "topics_name_not_blank" CHECK (length(trim("topics"."name")) > 0),
	CONSTRAINT "topics_color_format" CHECK ("topics"."color" ~ '^#[0-9A-F]{6}$'),
	CONSTRAINT "topics_duration_nonnegative" CHECK ("topics"."total_duration_seconds" >= 0),
	CONSTRAINT "topics_version_positive" CHECK ("topics"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX "topics_user_status_updated_idx" ON "topics" USING btree ("user_id","status","updated_at","id");