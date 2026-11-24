-- Target SP2D untuk seluruh lingkup (tanpa satker)
ALTER TYPE "InputJenis" ADD VALUE IF NOT EXISTS 'TARGET_LINGKUP';
ALTER TABLE "input_manual" ALTER COLUMN "satker_id" DROP NOT NULL;
-- NULL dianggap berbeda pada unique biasa, jadi baris lingkup diberi indeks unik sendiri
CREATE UNIQUE INDEX "input_manual_lingkup_key" ON "input_manual" ("jenis", "kode", "berlaku_mulai") WHERE "satker_id" IS NULL;