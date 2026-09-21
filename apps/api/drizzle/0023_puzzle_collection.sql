DO $$ BEGIN
  CREATE TYPE "puzzle_artwork_status" AS ENUM ('published', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "puzzle_artworks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" varchar(80) NOT NULL UNIQUE,
  "title" varchar(80) NOT NULL,
  "description" varchar(240) NOT NULL DEFAULT '',
  "asset_key" varchar(160) NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "piece_count" integer NOT NULL DEFAULT 12 CHECK ("piece_count" = 12),
  "status" "puzzle_artwork_status" NOT NULL DEFAULT 'published',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_puzzle_states" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "selected_artwork_id" uuid REFERENCES "puzzle_artworks"("id") ON DELETE RESTRICT,
  "credit" integer NOT NULL DEFAULT 0 CHECK ("credit" >= 0 AND "credit" < 3),
  "last_reward_date" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "puzzle_organize_events" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "paper_id" uuid NOT NULL REFERENCES "papers"("id") ON DELETE CASCADE,
  "counted_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "paper_id")
);

CREATE TABLE IF NOT EXISTS "puzzle_rewards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "artwork_id" uuid NOT NULL REFERENCES "puzzle_artworks"("id") ON DELETE RESTRICT,
  "piece_index" integer NOT NULL CHECK ("piece_index" >= 0 AND "piece_index" < 12),
  "earned_at" timestamptz NOT NULL DEFAULT now(),
  "reward_date" date NOT NULL,
  "revealed_at" timestamptz,
  CONSTRAINT "puzzle_rewards_piece_unique" UNIQUE ("user_id", "artwork_id", "piece_index"),
  CONSTRAINT "puzzle_rewards_daily_unique" UNIQUE ("user_id", "reward_date")
);
CREATE INDEX IF NOT EXISTS "puzzle_rewards_user_earned_idx" ON "puzzle_rewards" ("user_id", "earned_at");
