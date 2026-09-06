-- 学习会话关联纸页(M-4 / BE-309):桌面截图链路从问题起步,主题变为可选。
-- 纸页补齐来源与来源会话(M-1 延后字段),桌面收尾创建的"下一个问题"需要回链会话。
ALTER TABLE "study_sessions" ALTER COLUMN "topic_id" DROP NOT NULL;
ALTER TABLE "study_sessions" ADD COLUMN "paper_id" uuid;
ALTER TABLE "study_sessions" ADD COLUMN "source" varchar(30) DEFAULT 'manual_topic' NOT NULL;

DO $$ BEGIN
  ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_paper_source" CHECK (
    (
      "source" IN ('desktop_capture', 'desktop_existing_question')
      AND "paper_id" IS NOT NULL
      AND "topic_id" IS NULL
    )
    OR "source" = 'manual_topic'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "study_sessions_user_paper_idx"
  ON "study_sessions" USING btree ("user_id", "paper_id");

ALTER TABLE "papers" ADD COLUMN "source" varchar(20) DEFAULT 'mobile_direct' NOT NULL;
ALTER TABLE "papers" ADD COLUMN "source_session_id" uuid;

DO $$ BEGIN
  ALTER TABLE "papers" ADD CONSTRAINT "papers_source_domain" CHECK (
    "source" IN ('mobile_direct', 'desktop_capture', 'desktop_session')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "papers_source_session_idx"
  ON "papers" USING btree ("source_session_id");
