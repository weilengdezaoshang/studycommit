-- 纸页问题结构化字段:三态状态 + 确认问题文本 + 理解文本 + 解决时间。
-- 顺序固定:加列 -> 回填 -> 反写布尔列 -> CHECK -> 索引(回填必须先于 CHECK)。
DO $$ BEGIN
  CREATE TYPE "paper_question_status" AS ENUM ('none', 'thinking', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "question_text" text;
ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "understanding_text" text;
ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "question_resolved_at" timestamp with time zone;
ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "question_status" "paper_question_status" DEFAULT 'none' NOT NULL;

-- 回填(幂等,可重复执行):标记疑问的存量行以正文截断充当问题文本;
-- 已解决的存量行没有解决时间,以 updated_at 兜底,保证满足 CHECK。
UPDATE "papers" SET
  "question_status" = CASE
    WHEN "has_question" AND "is_question_resolved" THEN 'resolved'::"paper_question_status"
    WHEN "has_question" THEN 'thinking'::"paper_question_status"
    ELSE 'none'::"paper_question_status" END,
  "question_text" = CASE
    WHEN "has_question" THEN left("content", 2000)
    ELSE NULL END,
  "question_resolved_at" = CASE
    WHEN "has_question" AND "is_question_resolved" THEN "updated_at"
    ELSE NULL END
WHERE "question_status" = 'none'
  AND ("has_question" OR "question_text" IS NOT NULL OR "question_resolved_at" IS NOT NULL);

-- 双写一致:AI 确认曾绕过 has_question 写 is_question_resolved,这里归一回布尔列。
UPDATE "papers" SET
  "has_question" = ("question_status" <> 'none'),
  "is_question_resolved" = ("question_status" = 'resolved')
WHERE "has_question" <> ("question_status" <> 'none')
   OR "is_question_resolved" <> ("question_status" = 'resolved');

DO $$ BEGIN
  ALTER TABLE "papers" ADD CONSTRAINT "papers_question_state" CHECK (
    ("question_status" = 'resolved' AND "question_resolved_at" IS NOT NULL
      AND "question_text" IS NOT NULL AND length(trim("question_text")) > 0 AND length("question_text") <= 2000)
    OR ("question_status" = 'thinking' AND "question_resolved_at" IS NULL
      AND "question_text" IS NOT NULL AND length(trim("question_text")) > 0 AND length("question_text") <= 2000)
    OR ("question_status" = 'none' AND "question_resolved_at" IS NULL AND "question_text" IS NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "papers" ADD CONSTRAINT "papers_understanding_text_length" CHECK (
    "understanding_text" IS NULL OR length("understanding_text") <= 20000
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "papers_user_thinking_created_idx" ON "papers" ("user_id", "created_at" DESC, "id" DESC)
  WHERE "question_status" = 'thinking' AND "deleted_at" IS NULL;
