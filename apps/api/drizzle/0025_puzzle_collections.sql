ALTER TABLE "user_puzzle_states"
  ADD COLUMN IF NOT EXISTS "featured_artwork_id" uuid REFERENCES "puzzle_artworks"("id") ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS "user_puzzle_completions" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "artwork_id" uuid NOT NULL REFERENCES "puzzle_artworks"("id") ON DELETE RESTRICT,
  "completed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "artwork_id")
);
