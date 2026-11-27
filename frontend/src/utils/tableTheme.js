/*
 * Warna judul tabel (layar dan PDF dipakai bersama).
 *  - green : Rekap per satker dan Rekap BRMP Perkebunan
 *  - matrix: Realisasi Akrual / SP2D per jenis belanja
 */
export const THEME = {
  green: { head: '#274E13', total: '#D9EAD3' },
  matrix: {
    satker: '#073763',
    total: '#FFF2CC',
    groups: { 51: '#5B0F00', 52: '#0C343D', 53: '#C65911' },
    byIndex: ['#5B0F00', '#0C343D', '#C65911'],
  },
};

// Warna baris Rekap BRMP Perkebunan menurut tingkat
export const LEVEL_COLORS = { PROGRAM: '#A4C2F4', RO: '#FF9900', KOMPONEN: '#FFF2CC', SUBKOMPONEN: '#FFFFFF' };

export const groupColor = (kode, index) => THEME.matrix.groups[kode] || THEME.matrix.byIndex[index % 3];

// '#274E13' -> [39, 78, 19]
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Gaya judul kolom di layar: latar berwarna, huruf putih tebal
export const headStyle = (bg) => ({ backgroundColor: bg, color: '#ffffff', fontWeight: 700 });