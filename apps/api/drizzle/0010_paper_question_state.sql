ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "has_question" boolean DEFAULT false NOT NULL;
ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "is_question_resolved" boolean DEFAULT false NOT NULL;
