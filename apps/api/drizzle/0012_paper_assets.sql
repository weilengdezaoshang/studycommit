-- 图片资产:三步直传会话与私有对象存储键(BE-308 / M-2)。
-- 服务器不过图片二进制;status=pending 的会话过期后由清理任务删除对象并软删行。
DO $$ BEGIN
  CREATE TYPE "paper_asset_kind" AS ENUM ('image', 'source_screenshot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "paper_asset_status" AS ENUM ('pending', 'uploaded', 'attached', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "paper_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "paper_id" uuid,
  "upload_id" uuid NOT NULL,
  "kind" "paper_asset_kind" NOT NULL,
  "status" "paper_asset_status" DEFAULT 'pending' NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "width" integer,
  "height" integer,
  "sha256" text NOT NULL,
  "ocr_text" text,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "paper_assets" ADD CONSTRAINT "paper_assets_state" CHECK (
    ("status" = 'attached' AND "paper_id" IS NOT NULL)
    OR ("status" <> 'attached' AND "paper_id" IS NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "paper_assets" ADD CONSTRAINT "paper_assets_dimensions_required" CHECK (
    ("status" IN ('uploaded', 'attached') AND "width" IS NOT NULL AND "height" IS NOT NULL)
    OR ("status" IN ('pending', 'deleted'))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "paper_assets_user_upload_id_idx" ON "paper_assets" USING btree ("user_id","upload_id");
CREATE INDEX IF NOT EXISTS "paper_assets_paper_id_idx" ON "paper_assets" USING btree ("paper_id");
CREATE INDEX IF NOT EXISTS "paper_assets_pending_expiry_idx" ON "paper_assets" USING btree ("user_id","status","expires_at") WHERE "status" = 'pending';
