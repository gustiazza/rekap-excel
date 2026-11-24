-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "yellow_rows" INTEGER NOT NULL DEFAULT 0,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "upload_status" "UploadStatus" NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rekap_data" (
    "id" SERIAL NOT NULL,
    "upload_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "uploader_name" TEXT NOT NULL,
    "sheet_name" TEXT,
    "row_number" INTEGER,
    "uraian" TEXT NOT NULL,
    "pagu_revisi" DECIMAL(20,2),
    "lock_pagu" DECIMAL(20,2),
    "periode_lalu" DECIMAL(20,2),
    "periode_ini" DECIMAL(20,2),
    "sampai_periode" DECIMAL(20,2),
    "persentase" DECIMAL(10,2),
    "sisa_anggaran" DECIMAL(20,2),
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rekap_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "uploads_user_id_idx" ON "uploads"("user_id");

-- CreateIndex
CREATE INDEX "uploads_uploaded_at_idx" ON "uploads"("uploaded_at");

-- CreateIndex
CREATE INDEX "rekap_data_upload_id_idx" ON "rekap_data"("upload_id");

-- CreateIndex
CREATE INDEX "rekap_data_user_id_idx" ON "rekap_data"("user_id");

-- CreateIndex
CREATE INDEX "rekap_data_created_at_idx" ON "rekap_data"("created_at");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rekap_data" ADD CONSTRAINT "rekap_data_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rekap_data" ADD CONSTRAINT "rekap_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
