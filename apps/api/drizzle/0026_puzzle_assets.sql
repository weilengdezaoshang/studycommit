CREATE TABLE IF NOT EXISTS "puzzle_artwork_assets" (
  "key" varchar(80) PRIMARY KEY,
  "title" varchar(80) NOT NULL,
  "style" varchar(40) NOT NULL,
  "storage_key" varchar(500),
  "mime_type" varchar(40) NOT NULL DEFAULT 'image/png',
  "width" integer NOT NULL DEFAULT 1200,
  "height" integer NOT NULL DEFAULT 900,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "puzzle_artwork_assets" ("key", "title", "style", "storage_key") VALUES
('spring-rabbit','春日来信','水彩','puzzle-artworks/spring-rabbit/original.png'),('seaside-cat','海边慢读','彩铅','puzzle-artworks/seaside-cat/original.png'),('moon-bear','月亮晚安','蜡笔','puzzle-artworks/moon-bear/original.png'),
('cloud-train','云上慢车','粉彩','puzzle-artworks/cloud-train/original.png'),('autumn-bakery','秋日面包房','水粉','puzzle-artworks/autumn-bakery/original.png'),('rainy-lane','雨后小巷','钢笔淡彩','puzzle-artworks/rainy-lane/original.png'),
('bamboo-panda','竹间午睡','水墨','puzzle-artworks/bamboo-panda/original.png'),('winter-fox','雪夜归家','版画','puzzle-artworks/winter-fox/original.png'),('garden-picnic','花园野餐','手绘拼贴','puzzle-artworks/garden-picnic/original.png'),
('sunny-rooftop','屋顶晴天','复古漫画','puzzle-artworks/sunny-rooftop/original.png') ON CONFLICT ("key") DO NOTHING;
