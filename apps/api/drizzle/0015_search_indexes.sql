-- 纸页与箱子搜索(BE-310):pg_trgm 加速 ILIKE '%q%' 命中,
-- 中文按二元组对 pg_trgm 有效,满足首版;tsvector/zhparser 为后续升级路径。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "papers_content_trgm_idx"
  ON "papers" USING gin ("content" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "papers_question_text_trgm_idx"
  ON "papers" USING gin ("question_text" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "topics_name_trgm_idx"
  ON "topics" USING gin ("name" gin_trgm_ops);
