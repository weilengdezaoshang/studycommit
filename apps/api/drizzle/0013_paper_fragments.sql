-- 学习过程片段(M-3 / BE-309):学习会话期间"记下一点"的连续写入。
-- id 由客户端生成,兼作幂等锚点:重试返回同一行,不产生重复片段。
CREATE TABLE IF NOT EXISTS "paper_fragments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "paper_id" uuid NOT NULL REFERENCES "papers"("id"),
  "session_id" uuid NOT NULL REFERENCES "study_sessions"("id"),
  "content" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "paper_fragments" ADD CONSTRAINT "paper_fragments_state" CHECK (
    "version" >= 1
    AND "position" >= 0
    AND length(trim("content")) > 0
    AND length("content") <= 2000
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "paper_fragments_paper_position_idx"
  ON "paper_fragments" USING btree ("paper_id", "position", "id");
CREATE INDEX IF NOT EXISTS "paper_fragments_session_position_idx"
  ON "paper_fragments" USING btree ("session_id", "position", "id");
