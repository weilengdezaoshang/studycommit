ALTER TYPE "puzzle_artwork_status" ADD VALUE IF NOT EXISTS 'draft';
ALTER TABLE "puzzle_artworks" ADD COLUMN IF NOT EXISTS "style" varchar(40) NOT NULL DEFAULT '绘本';
