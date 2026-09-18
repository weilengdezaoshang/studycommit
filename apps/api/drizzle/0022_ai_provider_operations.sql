ALTER TABLE "ai_provider_config" ADD COLUMN "last_operation_id" uuid;
--> statement-breakpoint
CREATE TABLE "ai_provider_operations" (
	"operation_id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"protocol" varchar(20),
	"base_url" varchar(500),
	"model" varchar(120),
	"key_changed" boolean NOT NULL,
	"version_after" integer NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_provider_operations" ADD CONSTRAINT "ai_provider_operations_kind_valid" CHECK ("ai_provider_operations"."kind" IN ('save', 'disable'));
