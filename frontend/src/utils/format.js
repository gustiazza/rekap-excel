const TZ = 'Asia/Jakarta';

export const fmtNum = (n, digits = 2) =>
  n === null || n === undefined || n === ''
    ? '-'
    : Number(n).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ }) : '-';

export const fmtShortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }) : '-';

export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
      })
    : '-';

export const STATUS_LABEL = { SUCCESS: 'Berhasil', PARTIAL: 'Sebagian', FAILED: 'Gagal' };
export const ROLE_LABEL = { ADMIN: 'Admin', USER: 'User' };

// Rupiah lengkap: "Rp 1.290.000.000"
export const fmtRp = (n) => (n === null || n === undefined || n === '' ? '-' : `Rp ${fmtNum(n, 2)}`);

// Rupiah ringkas untuk kartu/grafik: Rp 1,29 M (miliar), Rp 380 jt (juta), dst.
export const fmtRpShort = (n) => {
  if (n === null || n === undefined || n === '') return '-';
  const v = Number(n);
  const a = Math.abs(v);
  if (a >= 1e12) return `Rp ${fmtNum(v / 1e12, 2)} T`;
  if (a >= 1e9) return `Rp ${fmtNum(v / 1e9, 2)} M`;
  if (a >= 1e6) return `Rp ${fmtNum(v / 1e6, 2)} jt`;
  return `Rp ${fmtNum(v, 0)}`;
};

// Angka sumbu grafik: 1,5 M / 380 jt / 12 rb
export const fmtAxis = (n) => {
  const v = Number(n);
  const a = Math.abs(v);
  if (a >= 1e12) return `${fmtNum(v / 1e12, 1)} T`;
  if (a >= 1e9) return `${fmtNum(v / 1e9, 1)} M`;
  if (a >= 1e6) return `${fmtNum(v / 1e6, 0)} jt`;
  if (a >= 1e3) return `${fmtNum(v / 1e3, 0)} rb`;
  return fmtNum(v, 0);
};

export const fmtPct = (n) => (n === null || n === undefined || n === '' ? '-' : `${fmtNum(n, 2)}%`);

// Label jenis belanja dari 2 digit awal kode akun
export const BELANJA_LABEL = {
  51: 'Belanja Pegawai',
  52: 'Belanja Barang',
  53: 'Belanja Modal',
};
