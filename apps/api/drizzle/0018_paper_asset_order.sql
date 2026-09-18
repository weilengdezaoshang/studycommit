ALTER TABLE "papers" DROP CONSTRAINT IF EXISTS "papers_content_not_blank";
ALTER TABLE "paper_assets" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
WITH "ranked_assets" AS (
  SELECT
    "id",
    (ROW_NUMBER() OVER (
      PARTITION BY "paper_id"
      ORDER BY "created_at", "id"
    ) - 1)::integer AS "position"
  FROM "paper_assets"
  WHERE "status" = 'attached' AND "deleted_at" IS NULL
)
UPDATE "paper_assets"
SET "position" = "ranked_assets"."position"
FROM "ranked_assets"
WHERE "paper_assets"."id" = "ranked_assets"."id";
CREATE UNIQUE INDEX "paper_assets_paper_position_unique"
  ON "paper_assets" USING btree ("paper_id", "position")
  WHERE "paper_assets"."status" = 'attached' AND "paper_assets"."deleted_at" IS NULL;
