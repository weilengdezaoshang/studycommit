CREATE TABLE "papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"topic_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "papers_content_not_blank" CHECK (length(trim("papers"."content")) > 0),
	CONSTRAINT "papers_content_length" CHECK (length("papers"."content") <= 20000),
	CONSTRAINT "papers_version_positive" CHECK ("papers"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "papers" ADD CONSTRAINT "papers_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "papers_user_created_idx" ON "papers" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "papers_user_topic_created_idx" ON "papers" USING btree ("user_id","topic_id","created_at","id");