-- Kategori upload (Akrual / SP2D), semua upload tetap aktif, dan input manual (pagu total, target SP2D) dengan riwayat.
-- Aman dijalankan pada database yang sudah berisi data (upload lama dianggap Akrual).

-- CreateEnum
CREATE TYPE "KategoriRekap" AS ENUM ('AKRUAL', 'SP2D');
CREATE TYPE "InputJenis" AS ENUM ('PAGU_SATKER', 'PAGU_PROGRAM', 'PAGU_BELANJA', 'TARGET_SP2D');

-- uploads: kategori menggantikan is_current
ALTER TABLE "uploads" ADD COLUMN "kategori" "KategoriRekap" NOT NULL DEFAULT 'AKRUAL';
DROP INDEX IF EXISTS "uploads_satker_id_is_current_idx";
ALTER TABLE "uploads" DROP COLUMN "is_current";
CREATE INDEX "uploads_satker_id_kategori_uploaded_at_idx" ON "uploads"("satker_id", "kategori", "uploaded_at");

-- CreateTable
CREATE TABLE "input_manual" (
    "id" SERIAL NOT NULL,
    "satker_id" INTEGER NOT NULL,
    "jenis" "InputJenis" NOT NULL,
    "kode" TEXT NOT NULL DEFAULT '',
    "uraian" TEXT,
    "nilai" DECIMAL(20,2) NOT NULL,
    "berlaku_mulai" DATE NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "input_manual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "input_manual_satker_id_jenis_kode_berlaku_mulai_key" ON "input_manual"("satker_id", "jenis", "kode", "berlaku_mulai");
CREATE INDEX "input_manual_satker_id_jenis_kode_idx" ON "input_manual"("satker_id", "jenis", "kode");

-- AddForeignKey
ALTER TABLE "input_manual" ADD CONSTRAINT "input_manual_satker_id_fkey" FOREIGN KEY ("satker_id") REFERENCES "satker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "input_manual" ADD CONSTRAINT "input_manual_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
