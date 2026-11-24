# RekapXL — Sistem Rekap Data Excel Multi-User

Pengguna mengunggah file Excel. Sistem membaca warna latar sel, mengambil **hanya baris berwarna kuning**,
dan menyimpannya ke satu database bersama nama pengguna yang mengunggah (diambil dari akun login, bukan input manual).

Stack: React + Vite + Tailwind + Chart.js | Node.js + Express + Prisma + PostgreSQL + JWT + bcrypt + ExcelJS.

## 1. Prasyarat
- Node.js 18 atau lebih baru
- PostgreSQL 14 atau lebih baru (atau Docker, lihat langkah 2)

## 2. Siapkan database
Pilih salah satu.

**A. Dengan Docker** (dari folder root proyek):
```bash
docker compose up -d
```

**B. PostgreSQL manual:** buat database kosong, misalnya `rekap_excel`:
```sql
CREATE DATABASE rekap_excel;
```

## 3. Jalankan backend
```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```
Edit `.env`:
- `DATABASE_URL` sesuaikan user, password, dan nama database.
- `JWT_SECRET` ganti dengan string acak panjang. Contoh pembuatan:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `ADMIN_EMAIL` dan `ADMIN_PASSWORD` untuk akun admin pertama.

Lalu:
```bash
npx prisma migrate dev --name init   # membuat tabel users, uploads, rekap_data
npm run seed                          # membuat akun admin pertama
npm run dev                           # API berjalan di http://localhost:5000
```
Cek: buka http://localhost:5000/health, hasilnya `{"ok":true}`.

## 4. Jalankan frontend
Buka terminal baru:
```bash
cd frontend
npm install
npm run dev                           # http://localhost:5173
```
Login dengan `ADMIN_EMAIL` / `ADMIN_PASSWORD` dari `.env`, lalu buat pengguna lain di menu **Kelola Pengguna**.
Saat development, Vite meneruskan `/api` ke `localhost:5000`, jadi tidak perlu konfigurasi tambahan.

## 5. Cara kerja deteksi baris kuning
1. Sistem mencari baris header (pada 30 baris pertama) dengan mencocokkan nama kolom:
   `Uraian`, `Pagu Revisi`, `Lock Pagu`, `Periode Lalu`, `Periode Ini`, `Sampai Periode`, `%`/`Persentase`, `Sisa Anggaran`.
   Jika header tidak ditemukan, kolom dibaca berurutan A sampai H dengan urutan di atas.
2. Untuk setiap baris data, sistem menghitung sel yang berisi data dan berapa di antaranya berlatar kuning.
   Jika proporsinya >= `YELLOW_ROW_THRESHOLD` (default `0.5` = 50%), baris diambil.
3. Warna dinormalisasi dari ARGB/RGB, theme color + tint, dan indexed color, lalu dicek di ruang HSL/HSV
   (hue 40-70, saturasi >= 0.15, kecerahan >= 0.6). Jadi kuning murni (FFFF00), kuning muda, dan emas/kuning
   tema Office terbaca, tanpa satu kode RGB yang di-hardcode. Ambang ini ada di `backend/src/config.js`.
4. Seluruh worksheet yang terlihat (tidak tersembunyi) diproses.

Fungsi utama ada di `backend/src/services/colorDetector.js`:
`detectYellowColor(cell)`, `isYellowRow(row, opts)`, `extractYellowRows(worksheet, opts)`.

## 6. Keamanan dan hak akses
- Password disimpan sebagai hash bcrypt. Login dibatasi 20 percobaan per 15 menit.
- Setiap request memverifikasi JWT dan memuat ulang role/status dari database, sehingga akun yang dinonaktifkan
  langsung ditolak. Pengecekan role dilakukan di backend, bukan hanya menyembunyikan menu.
- USER hanya dapat membuka upload, rekap, dan export miliknya. Endpoint `/api/users` dan hapus upload hanya untuk ADMIN.
- Pengguna yang sudah punya riwayat upload tidak bisa dihapus (cukup dinonaktifkan) agar identitas uploader tidak hilang.

## 7. Endpoint API
| Method | Path | Akses |
|---|---|---|
| POST | /api/auth/login | publik |
| GET | /api/auth/me | login |
| PUT | /api/auth/password | login |
| GET | /api/dashboard | login (isi berbeda per role) |
| POST | /api/uploads | login (field form `file`) |
| GET | /api/uploads | login (USER: miliknya, ADMIN: semua) |
| GET | /api/uploads/:id | pemilik atau ADMIN |
| DELETE | /api/uploads/:id | ADMIN |
| GET | /api/rekap | login (filter: search, user_id, upload_id, file, date_from, date_to, page) |
| GET | /api/rekap/export | login (filter sama, hasil file .xlsx) |
| GET, POST | /api/users | ADMIN |
| PUT | /api/users/:id | ADMIN |
| PUT | /api/users/:id/status | ADMIN |
| PUT | /api/users/:id/password | ADMIN |
| DELETE | /api/users/:id | ADMIN |

## 8. Production
```bash
cd frontend && npm run build        # hasil di frontend/dist
cd ../backend && npx prisma migrate deploy && npm start
```
Set `VITE_API_URL` di frontend (URL API lengkap) sebelum build, dan `CLIENT_URL` di backend ke domain frontend.
Gunakan HTTPS dan `JWT_SECRET` yang kuat.

## 9. Batasan yang perlu diketahui
- Hanya format **.xlsx**. Format .xls lama tidak menyimpan warna secara andal dan tidak didukung ExcelJS;
  simpan ulang file sebagai .xlsx.
- Warna tema dihitung dengan palet Office default. Jika file memakai tema kustom, gunakan warna kuning standar
  (FFFF00) atau warna dari palet "Standard Colors".
- Header yang terpecah di dua baris digabung (merged) dibaca per sel pada baris yang berisi nama kolom.
