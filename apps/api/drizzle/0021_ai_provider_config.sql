CREATE TABLE "ai_provider_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"protocol" varchar(20) NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"model" varchar(120) NOT NULL,
	"api_key_ciphertext" text,
	"api_key_hint" varchar(32),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_test_status" varchar(20),
	"last_tested_at" timestamp with time zone,
	"last_tested_version" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ai_provider_config" ADD CONSTRAINT "ai_provider_config_version_positive" CHECK ("ai_provider_config"."version" >= 1);
--> statement-breakpoint
ALTER TABLE "ai_provider_config" ADD CONSTRAINT "ai_provider_config_status_valid" CHECK ("ai_provider_config"."status" IN ('active', 'disabled'));
--> statement-breakpoint
ALTER TABLE "ai_provider_config" ADD CONSTRAINT "ai_provider_config_protocol_valid" CHECK ("ai_provider_config"."protocol" IN ('openai', 'anthropic', 'gemini'));
--> statement-breakpoint
ALTER TABLE "ai_provider_config" ADD CONSTRAINT "ai_provider_config_test_status_valid" CHECK ("ai_provider_config"."last_test_status" IS NULL OR "ai_provider_config"."last_test_status" IN ('success', 'failed', 'unverified'));
