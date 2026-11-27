// Tanggal acuan laporan: tanggal "Sampai tanggal" pada filter, atau hari ini (WIB) bila filter kosong.
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const todayWib = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

export const refDateOf = (dateTo) => (/^\d{4}-\d{2}-\d{2}$/.test(String(dateTo || '')) ? String(dateTo) : todayWib());

// '2026-11-20' -> '20 November 2026'
export function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// Judul kolom target dengan tanggal acuan
export const targetLabel = (ref) => (ref ? `% Target SP2D s.d ${longDate(ref)}` : '% Target SP2D');