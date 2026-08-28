DO $$ BEGIN
	CREATE TYPE "public"."paper_background" AS ENUM('plain', 'dot', 'rule', 'grid');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(18) NOT NULL,
	"icon" varchar(100) NOT NULL,
	"paper_background" "paper_background" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "templates_name_not_blank" CHECK (length(trim("templates"."name")) > 0),
	CONSTRAINT "templates_icon_not_blank" CHECK (length(trim("templates"."icon")) > 0),
	CONSTRAINT "templates_version_positive" CHECK ("templates"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_user_created_idx" ON "templates" USING btree ("user_id","created_at","id");--> statement-breakpoint
INSERT INTO "templates" ("id", "name", "icon", "paper_background") VALUES
	('aa000000-0000-4000-8000-000000000001', '空白', 'box', 'plain'),
	('aa000000-0000-4000-8000-000000000002', '点阵', 'dot', 'dot'),
	('aa000000-0000-4000-8000-000000000003', '横线', 'rule', 'rule'),
	('aa000000-0000-4000-8000-000000000004', '方格', 'grid', 'grid')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "template_id" uuid;--> statement-breakpoint
UPDATE "topics" SET "template_id" = 'aa000000-0000-4000-8000-000000000001' WHERE "template_id" IS NULL;--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "template_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "topics" ADD CONSTRAINT "topics_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
UPDATE "topics" AS duplicate
SET
	"deleted_at" = now(),
	"updated_at" = now(),
	"version" = duplicate."version" + 1
WHERE duplicate."deleted_at" IS NULL
	AND EXISTS (
		SELECT 1
		FROM "topics" AS keeper
		WHERE keeper."deleted_at" IS NULL
			AND keeper."user_id" = duplicate."user_id"
			AND lower(trim(keeper."name")) = lower(trim(duplicate."name"))
			AND (
				keeper."updated_at" > duplicate."updated_at"
				OR (keeper."updated_at" = duplicate."updated_at" AND keeper."id" > duplicate."id")
			)
	);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "topics_user_name_unique" ON "topics" USING btree ("user_id",lower(trim("name"))) WHERE "topics"."deleted_at" is null;