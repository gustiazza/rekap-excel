-- Satker, NIP sebagai pengganti email, kode uraian, dan upload aktif per satker.
-- Aman dijalankan pada database yang sudah berisi data.

-- CreateEnum
CREATE TYPE "RekapTipe" AS ENUM ('TOTAL', 'PROGRAM', 'KEGIATAN', 'KRO', 'RO', 'KOMPONEN', 'SUBKOMPONEN', 'AKUN', 'LAINNYA');

-- CreateTable
CREATE TABLE "satker" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "satker_name_key" ON "satker"("name");

-- Lima satker
INSERT INTO "satker" ("name") VALUES
  ('BRMP Perkebunan'),
  ('BRMP Tanaman Rempah, Obat dan Aromatik'),
  ('BRMP Tanaman Industri dan Penyegar'),
  ('BRMP Tanaman Pemanis dan Serat'),
  ('BRMP Tanaman Palma');

-- users: NIP menggantikan email
ALTER TABLE "users" ADD COLUMN "nip" TEXT;
ALTER TABLE "users" ADD COLUMN "satker_id" INTEGER;

-- Akun lama diberi NIP sementara (18 digit: nol + id pengguna). Ubah lewat menu Kelola Pengguna.
UPDATE "users" SET "nip" = LPAD("id"::text, 18, '0');

ALTER TABLE "users" ALTER COLUMN "nip" SET NOT NULL;
CREATE UNIQUE INDEX "users_nip_key" ON "users"("nip");
CREATE INDEX "users_satker_id_idx" ON "users"("satker_id");
DROP INDEX IF EXISTS "users_email_key";
ALTER TABLE "users" DROP COLUMN "email";

-- uploads
ALTER TABLE "uploads" ADD COLUMN "satker_id" INTEGER;
ALTER TABLE "uploads" ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "uploads" ADD COLUMN "total_pagu_revisi" DECIMAL(20,2);
ALTER TABLE "uploads" ADD COLUMN "total_sampai_periode" DECIMAL(20,2);
ALTER TABLE "uploads" ADD COLUMN "total_persentase" DECIMAL(10,2);
UPDATE "uploads" SET "satker_id" = (SELECT "satker_id" FROM "users" WHERE "users"."id" = "uploads"."user_id");
CREATE INDEX "uploads_satker_id_is_current_idx" ON "uploads"("satker_id", "is_current");

-- rekap_data
ALTER TABLE "rekap_data" ADD COLUMN "satker_id" INTEGER;
ALTER TABLE "rekap_data" ADD COLUMN "kode" TEXT;
ALTER TABLE "rekap_data" ADD COLUMN "tipe" "RekapTipe" NOT NULL DEFAULT 'LAINNYA';
ALTER TABLE "rekap_data" ADD COLUMN "program_kode" TEXT;
UPDATE "rekap_data" SET "satker_id" = (SELECT "satker_id" FROM "uploads" WHERE "uploads"."id" = "rekap_data"."upload_id");
CREATE INDEX "rekap_data_upload_id_tipe_idx" ON "rekap_data"("upload_id", "tipe");
CREATE INDEX "rekap_data_satker_id_idx" ON "rekap_data"("satker_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_satker_id_fkey" FOREIGN KEY ("satker_id") REFERENCES "satker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_satker_id_fkey" FOREIGN KEY ("satker_id") REFERENCES "satker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rekap_data" ADD CONSTRAINT "rekap_data_satker_id_fkey" FOREIGN KEY ("satker_id") REFERENCES "satker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
