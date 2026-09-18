CREATE TYPE "public"."admin_role_level" AS ENUM('viewer', 'operator', 'publisher', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."campaign_claim_status" AS ENUM('granted', 'pending_compensation');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'published', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('registration_bonus', 'limited_claim');--> statement-breakpoint
CREATE TYPE "public"."credit_grant_source" AS ENUM('campaign', 'admin_grant');--> statement-breakpoint
CREATE TYPE "public"."credit_grant_status" AS ENUM('active', 'expired');--> statement-breakpoint
CREATE TYPE "public"."credit_ledger_kind" AS ENUM('grant', 'reserve', 'settle', 'release', 'expire');--> statement-breakpoint
CREATE TYPE "public"."credit_reservation_status" AS ENUM('active', 'settled', 'released', 'expired');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "idempotency_key" varchar(200);--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "request_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "price_version" integer;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "reserved_credits" integer;--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(100) NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"reason" varchar(500) NOT NULL,
	"request_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "admin_role_level" NOT NULL,
	"granted_by" uuid,
	"reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_cost_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"budget" numeric(14, 4) NOT NULL,
	"reserved_cost" numeric(14, 4) DEFAULT '0' NOT NULL,
	"confirmed_cost" numeric(14, 4) DEFAULT '0' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_cost_budgets_budget_nonnegative" CHECK ("ai_cost_budgets"."budget" >= 0),
	CONSTRAINT "ai_cost_budgets_reserved_nonnegative" CHECK ("ai_cost_budgets"."reserved_cost" >= 0),
	CONSTRAINT "ai_cost_budgets_confirmed_nonnegative" CHECK ("ai_cost_budgets"."confirmed_cost" >= 0),
	CONSTRAINT "ai_cost_budgets_period_ordered" CHECK ("ai_cost_budgets"."period_start" < "ai_cost_budgets"."period_end")
);
--> statement-breakpoint
CREATE TABLE "ai_price_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(50) NOT NULL,
	"version" integer NOT NULL,
	"price_credits" integer NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_price_versions_price_nonnegative" CHECK ("ai_price_versions"."price_credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_service_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_protection_enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_service_config_version_positive" CHECK ("ai_service_config"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"type" "campaign_type" NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"current_version" integer DEFAULT 0 NOT NULL,
	"draft_config" jsonb NOT NULL,
	"total_granted_credits" integer DEFAULT 0 NOT NULL,
	"total_claim_count" integer DEFAULT 0 NOT NULL,
	"total_budget_credits" integer,
	"total_claim_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_version_nonnegative" CHECK ("campaigns"."current_version" >= 0),
	CONSTRAINT "campaigns_budget_nonnegative" CHECK ("campaigns"."total_budget_credits" IS NULL OR "campaigns"."total_budget_credits" >= 0),
	CONSTRAINT "campaigns_claim_limit_nonnegative" CHECK ("campaigns"."total_claim_limit" IS NULL OR "campaigns"."total_claim_limit" >= 0),
	CONSTRAINT "campaigns_granted_nonnegative" CHECK ("campaigns"."total_granted_credits" >= 0),
	CONSTRAINT "campaigns_claim_count_nonnegative" CHECK ("campaigns"."total_claim_count" >= 0),
	CONSTRAINT "campaigns_budget_respected" CHECK ("campaigns"."total_budget_credits" IS NULL OR "campaigns"."total_granted_credits" <= "campaigns"."total_budget_credits"),
	CONSTRAINT "campaigns_claim_limit_respected" CHECK ("campaigns"."total_claim_limit" IS NULL OR "campaigns"."total_claim_count" <= "campaigns"."total_claim_limit")
);
--> statement-breakpoint
CREATE TABLE "campaign_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"grant_credits" integer NOT NULL,
	"credit_validity_days" integer,
	"fixed_expires_at" timestamp with time zone,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"eligibility_version" integer NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_versions_credits_positive" CHECK ("campaign_versions"."grant_credits" >= 1),
	CONSTRAINT "campaign_versions_per_user_limit_positive" CHECK ("campaign_versions"."per_user_limit" >= 1),
	CONSTRAINT "campaign_versions_window_ordered" CHECK ("campaign_versions"."starts_at" < "campaign_versions"."ends_at"),
	CONSTRAINT "campaign_versions_validity_exclusive" CHECK (("campaign_versions"."credit_validity_days" IS NULL) <> ("campaign_versions"."fixed_expires_at" IS NULL)),
	CONSTRAINT "campaign_versions_validity_days_positive" CHECK ("campaign_versions"."credit_validity_days" >= 1)
);
--> statement-breakpoint
CREATE TABLE "campaign_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"slot" integer DEFAULT 1 NOT NULL,
	"status" "campaign_claim_status" DEFAULT 'granted' NOT NULL,
	"grant_id" uuid,
	"idempotency_key" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"lifetime_granted" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_accounts_available_nonnegative" CHECK ("credit_accounts"."available" >= 0),
	CONSTRAINT "credit_accounts_reserved_nonnegative" CHECK ("credit_accounts"."reserved" >= 0),
	CONSTRAINT "credit_accounts_lifetime_nonnegative" CHECK ("credit_accounts"."lifetime_granted" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "credit_grant_source" DEFAULT 'campaign' NOT NULL,
	"campaign_id" uuid,
	"claim_id" uuid,
	"original_amount" integer NOT NULL,
	"remaining_available" integer NOT NULL,
	"frozen_amount" integer DEFAULT 0 NOT NULL,
	"status" "credit_grant_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_grants_original_positive" CHECK ("credit_grants"."original_amount" >= 1),
	CONSTRAINT "credit_grants_remaining_nonnegative" CHECK ("credit_grants"."remaining_available" >= 0),
	CONSTRAINT "credit_grants_frozen_nonnegative" CHECK ("credit_grants"."frozen_amount" >= 0),
	CONSTRAINT "credit_grants_amounts_within_original" CHECK ("credit_grants"."remaining_available" + "credit_grants"."frozen_amount" <= "credit_grants"."original_amount"),
	CONSTRAINT "credit_grants_expired_state" CHECK (("credit_grants"."status" = 'expired') = ("credit_grants"."expired_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "credit_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" "credit_reservation_status" DEFAULT 'active' NOT NULL,
	"price_version" integer NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_reservations_amount_positive" CHECK ("credit_reservations"."amount" >= 1),
	CONSTRAINT "credit_reservations_state_fields" CHECK (
    ("credit_reservations"."status" = 'active' AND "credit_reservations"."settled_at" IS NULL AND "credit_reservations"."released_at" IS NULL)
    OR ("credit_reservations"."status" = 'settled' AND "credit_reservations"."settled_at" IS NOT NULL AND "credit_reservations"."released_at" IS NULL)
    OR (("credit_reservations"."status" = 'released' OR "credit_reservations"."status" = 'expired') AND "credit_reservations"."settled_at" IS NULL AND "credit_reservations"."released_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "credit_allocations" (
	"reservation_id" uuid NOT NULL,
	"grant_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "credit_allocations_reservation_id_grant_id_pk" PRIMARY KEY("reservation_id","grant_id"),
	CONSTRAINT "credit_allocations_amount_positive" CHECK ("credit_allocations"."amount" >= 1)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"event_id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "credit_ledger_kind" NOT NULL,
	"delta_available" integer NOT NULL,
	"delta_reserved" integer NOT NULL,
	"balance_available_after" integer NOT NULL,
	"balance_reserved_after" integer NOT NULL,
	"grant_id" uuid,
	"reservation_id" uuid,
	"run_id" uuid,
	"campaign_id" uuid,
	"claim_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"event_id" varchar(100) PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_reservation_id_credit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_grant_id_credit_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_claim_id_campaign_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."campaign_claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_grant_id_credit_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."credit_grants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_reservation_id_credit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_user_idempotency_key_unique" ON "agent_runs" USING btree ("user_id","idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_cost_budgets_period_unique" ON "ai_cost_budgets" USING btree ("period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_price_versions_action_version_unique" ON "ai_price_versions" USING btree ("action","version");--> statement-breakpoint
CREATE INDEX "ai_price_versions_active_idx" ON "ai_price_versions" USING btree ("action","is_active") WHERE is_active;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_claims_campaign_user_slot_unique" ON "campaign_claims" USING btree ("campaign_id","user_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_claims_user_idempotency_unique" ON "campaign_claims" USING btree ("user_id","idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "campaign_claims_user_created_idx" ON "campaign_claims" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "campaign_claims_campaign_idx" ON "campaign_claims" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_versions_campaign_version_unique" ON "campaign_versions" USING btree ("campaign_id","version");--> statement-breakpoint
CREATE INDEX "campaign_versions_campaign_idx" ON "campaign_versions" USING btree ("campaign_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_code_unique" ON "campaigns" USING btree ("code");--> statement-breakpoint
CREATE INDEX "credit_grants_user_fefo_idx" ON "credit_grants" USING btree ("user_id","status","expires_at","id");--> statement-breakpoint
CREATE INDEX "credit_grants_expiry_sweep_idx" ON "credit_grants" USING btree ("status","expires_at") WHERE status = 'active' AND expires_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at","event_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_reservation_idx" ON "credit_ledger" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_campaign_idx" ON "credit_ledger" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_reservations_run_unique" ON "credit_reservations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "credit_reservations_user_status_idx" ON "credit_reservations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "credit_reservations_deadline_idx" ON "credit_reservations" USING btree ("status","deadline_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "outbox_events_dispatch_idx" ON "outbox_events" USING btree ("status","available_at") WHERE status IN ('pending', 'failed');--> statement-breakpoint
CREATE INDEX "admin_audit_logs_actor_created_idx" ON "admin_audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_target_idx" ON "admin_audit_logs" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_roles_role_idx" ON "admin_roles" USING btree ("role","user_id");