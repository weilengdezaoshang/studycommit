CREATE TYPE "public"."desk_zone" AS ENUM('wall', 'shelf', 'desktop', 'foreground');--> statement-breakpoint
CREATE TYPE "public"."knowledge_node_status" AS ENUM('locked', 'available', 'learning', 'learned', 'reviewing', 'mastered');--> statement-breakpoint
CREATE TYPE "public"."shared_memory_status" AS ENUM('active', 'deleted');--> statement-breakpoint
CREATE TABLE "desk_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) DEFAULT '默认书桌' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" "knowledge_node_status" DEFAULT 'available' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_log_id" uuid NOT NULL,
	"node_id" uuid,
	"original_text" text NOT NULL,
	"summary" varchar(2000) NOT NULL,
	"recall_at" timestamp with time zone NOT NULL,
	"status" "shared_memory_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_desk_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_key" varchar(100) NOT NULL,
	"instance_no" integer DEFAULT 1 NOT NULL,
	"source_session_id" uuid,
	"source_node_id" uuid,
	"seen_at" timestamp with time zone,
	"placement_status" varchar(20) DEFAULT 'collected' NOT NULL,
	"zone" "desk_zone",
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"scale" integer DEFAULT 100 NOT NULL,
	"z_index" integer DEFAULT 0 NOT NULL,
	"flipped" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"obtained_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_knowledge_progress" (
	"user_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"learning_log_count" integer DEFAULT 0 NOT NULL,
	"evidence_score" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_knowledge_progress_user_id_node_id_pk" PRIMARY KEY("user_id","node_id")
);
--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_memories" ADD CONSTRAINT "shared_memories_source_log_id_learning_logs_id_fk" FOREIGN KEY ("source_log_id") REFERENCES "public"."learning_logs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_memories" ADD CONSTRAINT "shared_memories_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_desk_items" ADD CONSTRAINT "user_desk_items_source_session_id_study_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."study_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_desk_items" ADD CONSTRAINT "user_desk_items_source_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_knowledge_progress" ADD CONSTRAINT "user_knowledge_progress_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "desk_layouts_user_active_unique_idx" ON "desk_layouts" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_user_topic_idx" ON "knowledge_nodes" USING btree ("user_id","topic_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_memories_user_source_unique_idx" ON "shared_memories" USING btree ("user_id","source_log_id");--> statement-breakpoint
CREATE INDEX "shared_memories_user_recall_idx" ON "shared_memories" USING btree ("user_id","status","recall_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_desk_items_source_unique_idx" ON "user_desk_items" USING btree ("user_id","source_session_id","item_key");--> statement-breakpoint
CREATE INDEX "user_desk_items_user_idx" ON "user_desk_items" USING btree ("user_id","updated_at");